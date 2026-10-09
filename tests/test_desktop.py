import tempfile
import unittest
from pathlib import Path
from runtime_paths import user_data_dir, resource_root
from packaged_check import run_checks

class DesktopTests(unittest.TestCase):
    def test_windows_profiles_outside_executable(self):
        self.assertEqual(user_data_dir('win32', {'LOCALAPPDATA': 'C:/Users/Demo/AppData/Local'}, 'C:/Users/Demo'),
                         Path('C:/Users/Demo/AppData/Local/SEMIN-Marketplace'))
        self.assertEqual(user_data_dir('win32', {}, 'C:/Users/Demo'),
                         Path('C:/Users/Demo/AppData/Local/SEMIN-Marketplace'))
        self.assertTrue((resource_root() / 'static' / 'index.html').is_file())

    def test_packaged_checks_and_profile_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            first = run_checks(Path(directory) / 'nested' / 'data')
            self.assertFalse(first['profile_from_previous_process'])
            second = run_checks(Path(directory) / 'nested' / 'data')
            self.assertTrue(second['profile_from_previous_process'])
            self.assertTrue(second['http_excel_export'])
            self.assertTrue(second['loopback_only'])
            self.assertTrue(second['invalid_export_blocked'])
