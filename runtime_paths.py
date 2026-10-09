"""Separate immutable bundled resources from persistent user configuration."""
import os
import sys
from pathlib import Path


def user_data_dir(platform=None, environ=None, home=None):
    platform = sys.platform if platform is None else platform
    environ = os.environ if environ is None else environ
    home = Path.home() if home is None else Path(home)
    if platform == 'win32':
        base = Path(environ.get('LOCALAPPDATA') or home / 'AppData' / 'Local')
    else:
        base = Path(environ.get('XDG_DATA_HOME') or home / '.local' / 'share')
    return base / 'SEMIN-Marketplace'


def resource_root():
    return Path(__file__).resolve().parent
