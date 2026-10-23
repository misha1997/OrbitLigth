"""Offline refresh-script checks; no production database or HTTP requests."""
from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

from scripts import refresh_news as refresh

BODY = 'Researchers have released a detailed observation of an unusual planet and its atmosphere.\n\n[VIDEO:0]'
URL = 'https://www.youtube.com/embed/178AiyS7QXo'


def snapshot():
    return {'article': {'id': 42, 'slug': 'planet', 'url': 'https://publisher.example/planet',
                        'title': 'Planet', 'body': BODY, 'body_uk': None, 'image': 'https://images.example/planet.jpg'},
            'images': [], 'videos': []}


def content():
    return {'body': BODY, 'image': 'https://images.example/planet.jpg', 'body_images': [], 'body_videos': [URL]}


def database(old):
    conn = Mock()
    cursor = conn.cursor.return_value
    cursor.fetchone.return_value = deepcopy(old['article'])
    cursor.fetchall.side_effect = [deepcopy(old['images']), deepcopy(old['videos'])]
    return conn, cursor


class RefreshNewsTests(unittest.TestCase):
    def test_partial_missing_video_rows_and_translation_mismatch_are_candidates(self):
        old = snapshot()
        old['article']['body'] += '\n\n[VIDEO:1]'
        old['article']['body_uk'] = BODY
        old['videos'] = [{'position': 0, 'video_url': URL}]
        reasons = refresh.candidate_reasons(old)
        self.assertIn('missing_videos', reasons)
        self.assertIn('translation_media_mismatch', reasons)

    def test_healthy_article_has_no_candidate_reasons(self):
        old = snapshot()
        old['videos'] = [{'position': 0, 'video_url': URL}]
        self.assertEqual(refresh.candidate_reasons(old), [])

    def test_empty_source_and_missing_source_videos_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'source_empty'):
            refresh.validate_content(snapshot(), {'body': ''})
        value = content()
        value['body_videos'] = []
        with self.assertRaisesRegex(ValueError, 'source_has_no_videos'):
            refresh.validate_content(snapshot(), value)

    def test_truncated_source_cannot_replace_a_long_article(self):
        old = snapshot()
        old['article']['body'] = 'a' * 4000
        value = content()
        with self.assertRaisesRegex(ValueError, 'suspiciously_short'):
            refresh.validate_content(old, value)

    def test_success_has_durable_backup_before_one_commit(self):
        old = snapshot()
        conn, cursor = database(old)
        with TemporaryDirectory() as directory:
            backup = Path(directory) / '42.json'
            def execute(sql, params):
                if sql.startswith(('UPDATE', 'DELETE', 'INSERT')):
                    self.assertTrue(backup.exists())
            cursor.execute.side_effect = execute
            refresh.apply_refresh(old, content(), [], backup, connect=lambda: conn)
            saved = json.loads(backup.read_text(encoding='utf-8'))
        self.assertEqual(saved['article'], old['article'])
        self.assertEqual(saved['videos'], old['videos'])
        conn.commit.assert_called_once()
        conn.rollback.assert_not_called()
        writes = [call.args for call in cursor.execute.call_args_list if call.args[0].startswith('INSERT INTO news_article_videos')]
        self.assertEqual(writes[0][1], (42, 0, URL))
        update = next(call.args for call in cursor.execute.call_args_list if call.args[0].startswith('UPDATE'))
        self.assertNotIn('title =', update[0])
        self.assertNotIn('slug =', update[0])
        cursor.close.assert_called_once()
        conn.close.assert_called_once()

    def test_sql_error_rolls_back_body_and_media_together(self):
        old = snapshot()
        conn, cursor = database(old)
        def execute(sql, params):
            if sql.startswith('INSERT INTO news_article_videos'):
                raise RuntimeError('database write failed')
        cursor.execute.side_effect = execute
        with TemporaryDirectory() as directory, self.assertRaisesRegex(RuntimeError, 'database write failed'):
            refresh.apply_refresh(old, content(), [], Path(directory) / '42.json', connect=lambda: conn)
        conn.rollback.assert_called_once()
        conn.commit.assert_not_called()

    def test_interrupt_also_rolls_back(self):
        old = snapshot()
        conn, cursor = database(old)
        def execute(sql, params):
            if sql.startswith('DELETE'):
                raise KeyboardInterrupt()
        cursor.execute.side_effect = execute
        with TemporaryDirectory() as directory, self.assertRaises(KeyboardInterrupt):
            refresh.apply_refresh(old, content(), [], Path(directory) / '42.json', connect=lambda: conn)
        conn.rollback.assert_called_once()
        conn.commit.assert_not_called()

    def test_backup_failure_prevents_all_writes(self):
        old = snapshot()
        conn, cursor = database(old)
        with patch.object(refresh, 'write_backup', side_effect=OSError('disk full')), self.assertRaises(OSError):
            refresh.apply_refresh(old, content(), [], Path('unused'), connect=lambda: conn)
        self.assertFalse(any(call.args[0].startswith(('UPDATE', 'DELETE', 'INSERT')) for call in cursor.execute.call_args_list))
        conn.commit.assert_not_called()
        conn.rollback.assert_called_once()

    def test_concurrent_edit_is_preserved(self):
        old = snapshot()
        changed = deepcopy(old)
        changed['article']['body'] = 'Edited by administrator'
        conn, cursor = database(changed)
        with TemporaryDirectory() as directory, self.assertRaisesRegex(ValueError, 'concurrent_edit'):
            refresh.apply_refresh(old, content(), [], Path(directory) / '42.json', connect=lambda: conn)
        conn.commit.assert_not_called()
        self.assertFalse(any(call.args[0].startswith(('UPDATE', 'DELETE', 'INSERT')) for call in cursor.execute.call_args_list))

    def test_changed_english_resets_translation_but_unchanged_body_keeps_it(self):
        for changed in (False, True):
            with self.subTest(changed=changed):
                old = snapshot()
                old['article']['body_uk'] = 'Переклад статті.\n\n[VIDEO:0]'
                value = content()
                if changed:
                    value['body'] = 'An updated observation. ' + BODY
                conn, cursor = database(old)
                with TemporaryDirectory() as directory:
                    refresh.apply_refresh(old, value, [], Path(directory) / '42.json', connect=lambda: conn)
                update = next(call.args for call in cursor.execute.call_args_list if call.args[0].startswith('UPDATE'))
                self.assertEqual(update[1][1], None if changed else old['article']['body_uk'])

    def test_dry_run_never_fetches_a_source_or_updates_a_row(self):
        with patch.object(refresh, 'load_snapshots', return_value=[snapshot()]), \
             patch.object(refresh, 'apply_refresh') as apply, \
             patch('parsers.news.NewsParser.get_article_content') as fetch:
            self.assertEqual(refresh.main(['--dry-run']), 0)
        apply.assert_not_called()
        fetch.assert_not_called()

    def test_limit_and_resume_select_the_requested_batch(self):
        old = snapshot()
        later = deepcopy(old)
        later['article']['id'] = 43
        later['article']['slug'] = 'later'
        with patch.object(refresh, 'load_snapshots', return_value=[old, later]), \
             patch.object(refresh, 'candidate_reasons', return_value=['missing_videos']) as reasons:
            self.assertEqual(refresh.main(['--dry-run', '--after-id', '42', '--limit', '1']), 0)
        reasons.assert_called_once_with(later, media_root=refresh.ROOT / 'data/news')


if __name__ == '__main__':
    unittest.main()
