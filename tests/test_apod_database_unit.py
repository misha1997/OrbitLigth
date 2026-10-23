"""APOD persistence regressions without MySQL or provider HTTP calls."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch


class ApodDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.error=type('DatabaseError',(Exception,),{})
        connector=types.ModuleType('mysql.connector'); connector.Error=self.error
        pool=types.ModuleType('database.pool'); pool.get_db_connection=Mock()
        self.conn=pool.get_db_connection.return_value
        self.cursor=self.conn.cursor.return_value
        self.cursor.fetchone.return_value=None
        mirror=types.ModuleType('services.apod_images')
        mirror.cached_apod_media=Mock(return_value=False)
        mirror.download_apod_media=Mock(return_value=('2026/10/23-full.png','2026/10/23-thumb.jpg'))
        translator=types.ModuleType('utils.translator'); translator.Translator=Mock()
        translator.Translator.translate.side_effect=lambda text,*args:text
        self.mirror=mirror
        self.patches=patch.dict(sys.modules,{'mysql.connector':connector,'database.pool':pool,'services.apod_images':mirror,'utils.translator':translator})
        self.patches.start(); self.addCleanup(self.patches.stop)
        spec=importlib.util.spec_from_file_location('database.apod_unit',Path(__file__).parents[1]/'database/apod.py')
        self.db=importlib.util.module_from_spec(spec); spec.loader.exec_module(self.db)
        self.entry={'date':'2026-10-23','title':'Stars','explanation':'Source explanation','media_type':'image','copyright':'Photographer '*40}

    def test_long_new_api_credit_fits_database_and_failed_translation_is_not_persisted_as_ukrainian(self):
        self.assertEqual(self.db.ingest_apod_entries([self.entry]),1)
        insert=next(call.args for call in self.cursor.execute.call_args_list if call.args[0].lstrip().startswith('INSERT'))
        self.assertEqual(len(insert[1][8]),300)
        self.assertIsNone(insert[1][3])
        self.conn.commit.assert_called_once()

    def test_missing_cache_files_are_repaired_even_with_paths_in_the_database(self):
        self.cursor.fetchone.return_value={'full_path':'missing-full.jpg','thumb_path':'missing-thumb.jpg','explanation_uk':'Переклад'}
        self.assertEqual(self.db.ingest_apod_entries([self.entry]),1)
        self.mirror.download_apod_media.assert_called_once_with(self.entry)

    def test_database_rollback_never_reports_successfully_ingested_rows(self):
        def execute(sql,*args):
            if sql.lstrip().startswith('INSERT'):
                raise self.error('offline')
        self.cursor.execute.side_effect=execute
        with self.assertLogs('database.apod_unit',level='ERROR'):
            self.assertEqual(self.db.ingest_apod_entries([self.entry]),0)
        self.conn.rollback.assert_called_once()

    def test_placeholder_with_valid_files_is_replaced_and_retranslated(self):
        self.cursor.fetchone.return_value={'title':'NASA Science','full_path':'logo.png',
                                          'thumb_path':'logo-thumb.jpg','explanation_uk':'Старий неправильний опис'}
        self.mirror.cached_apod_media.return_value=True
        self.assertEqual(self.db.ingest_apod_entries([self.entry]),1)
        self.mirror.download_apod_media.assert_called_once_with(self.entry)
        insert=next(call.args for call in self.cursor.execute.call_args_list if call.args[0].lstrip().startswith('INSERT'))
        self.assertEqual(insert[1][1],'Stars')
        self.assertIsNone(insert[1][3])  # Do not keep the old, incorrectly dated translation.
        self.assertTrue(insert[1][-1])  # Replace the stored translation only for repairs.

    def test_failed_placeholder_repair_keeps_row_identifiable_for_retry(self):
        self.cursor.fetchone.return_value={'title':'NASA Science','full_path':'logo.png','thumb_path':'logo-thumb.jpg'}
        self.mirror.download_apod_media.return_value=(None,None)
        with self.assertLogs('database.apod_unit',level='WARNING'):
            self.assertEqual(self.db.ingest_apod_entries([self.entry]),0)
        self.assertFalse(any(call.args[0].lstrip().startswith('INSERT') for call in self.cursor.execute.call_args_list))

    def test_healthy_row_preserves_manual_edits_and_skips_download(self):
        self.cursor.fetchone.return_value={'title':'Manually edited title','full_path':'photo.png','thumb_path':'thumb.jpg'}
        self.mirror.cached_apod_media.return_value=True
        self.assertEqual(self.db.ingest_apod_entries([self.entry]),0)
        self.mirror.download_apod_media.assert_not_called()

    def test_placeholder_source_is_never_persisted(self):
        self.assertEqual(self.db.ingest_apod_entries([{**self.entry,'title':'NASA Science'}]),0)
        self.mirror.download_apod_media.assert_not_called()


if __name__=='__main__':
    unittest.main()
