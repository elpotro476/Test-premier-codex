"""Functional self-test executed inside the generated Windows executable."""
import json
import threading
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
import app
from engine import workbook


def run_checks(data_dir):
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    old_profiles = app.PROFILES
    app.PROFILES = data_dir / 'mappings.json'
    server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_port}'
    try:
        def get(path):
            with urlopen(base + path, timeout=15) as response:
                return response.read()
        assert b'Template Manager' in get('/')
        assert b'fetch' in get('/static/app.js')
        assert b'font-family' in get('/static/style.css')
        session = json.loads(get('/api/session'))
        persisted = 'Test compilation Windows' in session['profiles']
        def post(path, payload):
            with urlopen(Request(base + path, data=json.dumps(payload).encode(), headers={
                'X-Session': session['token'], 'Content-Type': 'application/json'}), timeout=15) as response:
                return response.read()
        for role, name in [('catalog', 'catalogue-demo.xlsx'), ('template', 'template-demo.xlsx')]:
            boundary = 'semin-build-test'
            data = get('/examples/' + name)
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="role"\r\n\r\n{role}\r\n'
                    f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
                    'Content-Type: application/octet-stream\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode()
            with urlopen(Request(base + '/api/upload', data=body, headers={
                'X-Session': session['token'], 'Content-Type': f'multipart/form-data; boundary={boundary}'}), timeout=15) as response:
                assert json.load(response)['sheets']
        prepared = json.loads(post('/api/prepare', {'catalogSheet': 'Produits', 'catalogHeader': 1,
                              'templateSheet': 'Offres', 'templateHeader': 2, 'startRow': 3}))
        payload = {'mapping': prepared['mapping'], 'required': [c['id'] for c in prepared['target'] if c['required']], 'selected': [2, 3, 4]}
        assert len(json.loads(post('/api/check', payload))['errors']) == 3
        try:
            post('/api/export', payload)
        except HTTPError as error:
            assert error.code == 400
        else:
            raise AssertionError('Invalid export was not blocked')
        payload['selected'] = [2, 3]
        assert not json.loads(post('/api/check', payload))['errors']
        exported = workbook(post('/api/export', payload))
        assert exported.sheetnames == ['Offres', 'Instructions']
        assert exported['Offres']['A3'].value == 'DEMO-001'
        assert exported['Offres']['B4'].value == '5901234123457'
        assert exported['Offres']['F4'].value == 12.5
        assert exported['Offres']['F4'].number_format == '#,##0.00'
        assert exported['Offres']['A2'].comment
        assert exported['Offres'].data_validations.dataValidation
        profile = {'signature': 'build-self-test', 'mapping': prepared['mapping'], 'required': payload['required']}
        post('/api/profile', {'name': 'Test compilation Windows', 'profile': profile})
        assert app.profiles()['Test compilation Windows'] == profile
        return {'http_excel_export': True, 'invalid_export_blocked': True,
                'profile_saved': True, 'profile_from_previous_process': persisted, 'loopback_only': server.server_address[0] == '127.0.0.1'}
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=5)
        app.PROFILES = old_profiles
        app.SESSIONS.clear()
