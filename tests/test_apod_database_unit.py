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
        self.assertEqual(len(insert[1][-1]),300)
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


if __name__=='__main__':
    unittest.main()
