"""Local HTTP application; no external services or catalogue persistence."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from email.parser import BytesParser
from email.policy import default
from pathlib import Path
from io import BytesIO
import argparse
import json
import secrets
import threading
import sys
from runtime_paths import resource_root, user_data_dir
from engine import inspect, workbook, columns, read_catalog, suggest, check, export

ROOT = resource_root()
SESSIONS = {}
LOCK = threading.RLock()
PROFILES = (user_data_dir() if getattr(sys, 'frozen', False) else ROOT / '.local') / 'mappings.json'

def profiles():
    if PROFILES.exists():
        return json.loads(PROFILES.read_text(encoding='utf-8'))
    return {}

def demo_files():
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.comments import Comment
    from openpyxl.worksheet.datavalidation import DataValidation
    catalogue = Workbook(); ws = catalogue.active; ws.title = 'Produits'
    ws.append(['SKU', 'EAN', 'Désignation', 'Description', 'Marque', 'Prix TTC', 'Stock'])
    ws.append(['DEMO-001', '4006381333931', 'Enduit de démonstration 5 kg', 'Produit fictif pour tester les imports.', 'SEMIN Démo', 18.9, 120])
    ws.append(['DEMO-002', '5901234123457', 'Colle de démonstration 2 kg', 'Produit fictif, sans usage commercial.', 'SEMIN Démo', 12.5, 45])
    ws.append(['DEMO-003', '1234567890123', 'Produit incomplet', None, 'SEMIN Démo', -5, 0])
    template = Workbook(); target = template.active; target.title = 'Offres'
    target.append(['TEMPLATE FICTIF — aucune marketplace réelle'])
    target.append(['SKU *', 'EAN *', 'Titre *', 'Description *', 'Marque *', 'Prix *', 'Quantité'])
    for cell in target[2]:
        cell.font = Font(bold=True, color='FFFFFF'); cell.fill = PatternFill('solid', fgColor='193A43')
        if '*' in cell.value: cell.comment = Comment('Champ obligatoire', 'Démo')
        target.column_dimensions[cell.column_letter].width = 25
    for cell in target[3]:
        cell.fill = PatternFill('solid', fgColor='EEF6F2')
    target['F3'].number_format = '#,##0.00'
    target.freeze_panes = 'A3'
    dv = DataValidation(type='decimal', operator='greaterThanOrEqual', formula1=0)
    dv.error = 'Prix positif requis'; dv.showErrorMessage = True
    target.add_data_validation(dv); dv.add('F3:F1000')
    notes = template.create_sheet('Instructions'); notes['A1'] = 'Démo uniquement. Vérifier le résultat avant import.'
    result = {}
    for name, wb in [('catalogue-demo.xlsx', catalogue), ('template-demo.xlsx', template)]:
        buffer = BytesIO(); wb.save(buffer); result[name] = buffer.getvalue()
    return result

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Avoid writing product values or uploaded filenames to logs.
        pass

    def send(self, body, content_type='application/json; charset=utf-8', status=200, filename=None):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False, default=str).encode('utf-8')
        elif isinstance(body, str): body = body.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'")
        if filename: self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.end_headers(); self.wfile.write(body)

    def session(self):
        token = self.headers.get('X-Session', '')
        if token not in SESSIONS: raise ValueError('Session expirée. Rechargez la page.')
        return SESSIONS[token]

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/session':
            with LOCK:
                if len(SESSIONS) >= 30: SESSIONS.pop(next(iter(SESSIONS)))
                token = secrets.token_urlsafe(24); SESSIONS[token] = {}
                self.send({'token': token, 'profiles': profiles()})
        elif path.startswith('/examples/') and path.removeprefix('/examples/') in demo_files():
            name = path.removeprefix('/examples/')
            self.send(demo_files()[name], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename=name)
        elif path in ('/', '/static/app.js', '/static/style.css'):
            file = ROOT / ('static/index.html' if path == '/' else path.lstrip('/'))
            content_type = 'text/html; charset=utf-8' if file.suffix == '.html' else ('text/javascript; charset=utf-8' if file.suffix == '.js' else 'text/css; charset=utf-8')
            self.send(file.read_bytes(), content_type)
        else: self.send({'error': 'Page introuvable'}, status=404)

    def do_POST(self):
        try:
            # Deny cross-origin requests to the local server.
            origin = self.headers.get('Origin')
            if origin and origin != f'http://{self.headers.get("Host")}':
                self.send({'error': 'Origine refusée'}, status=403); return
            length = int(self.headers.get('Content-Length', '0'))
            if length > 16 * 1024 * 1024: raise ValueError('Fichier trop volumineux (maximum 15 Mo).')
            raw = self.rfile.read(length)
            with LOCK:
                state = self.session()
                if self.path == '/api/upload':
                    content_type = self.headers.get('Content-Type', '')
                    msg = BytesParser(policy=default).parsebytes(('Content-Type: '+content_type+'\r\nMIME-Version: 1.0\r\n\r\n').encode() + raw)
                    parts = {p.get_param('name', header='content-disposition'): p for p in msg.iter_parts()}
                    role = parts['role'].get_payload(decode=True).decode()
                    if role not in ('catalog', 'template'): raise ValueError('Type d’import invalide.')
                    file = parts['file']; name = file.get_filename() or ''
                    if not name.lower().endswith('.xlsx'): raise ValueError('Seuls les fichiers .xlsx sont pris en charge dans cette démonstration.')
                    data = file.get_payload(decode=True)
                    sheets = inspect(data)
                    state[role] = data
                    state.pop('prepared', None)
                    self.send({'name': name, 'sheets': sheets}); return
                payload = json.loads(raw)
                if self.path == '/api/prepare':
                    if not all(k in state for k in ('catalog', 'template')): raise ValueError('Importez les deux fichiers.')
                    source, rows = read_catalog(state['catalog'], payload['catalogSheet'], int(payload['catalogHeader']))
                    target = columns(workbook(state['template'])[payload['templateSheet']], int(payload['templateHeader']))
                    start = int(payload['startRow'])
                    if start <= int(payload['templateHeader']): raise ValueError('La ligne de données doit suivre les en-têtes.')
                    state['prepared'] = {'source': source, 'rows': rows, 'target': target, 'settings': payload}
                    self.send({'source': source, 'rows': rows, 'target': target, 'mapping': suggest(source, target)}); return
                if self.path == '/api/profile':
                    name = str(payload['name']).strip()
                    if not name or len(name) > 100: raise ValueError('Nom de marketplace requis (100 caractères maximum).')
                    saved = profiles(); saved[name] = payload['profile']
                    PROFILES.parent.mkdir(parents=True, exist_ok=True)
                    tmp = PROFILES.with_suffix('.tmp'); tmp.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding='utf-8'); tmp.replace(PROFILES)
                    self.send({'profiles': saved}); return
                if self.path not in ('/api/check', '/api/export'): self.send({'error':'Route introuvable'},status=404); return
                prepared = state.get('prepared')
                if not prepared: raise ValueError('Analysez les fichiers avant de continuer.')
                source_ids = {c['id'] for c in prepared['source']}; target_ids = {c['id'] for c in prepared['target']}
                mapping = payload['mapping']; required = payload['required']; selected = payload['selected']
                if any(k not in target_ids or (v and v not in source_ids) for k,v in mapping.items()) or any(k not in target_ids for k in required):
                    raise ValueError('Correspondance invalide.')
                result = check(prepared['rows'], prepared['target'], mapping, required, selected)
                if self.path == '/api/check': self.send(result)
                else:
                    settings = prepared['settings']
                    data = export(state['template'], settings['templateSheet'], int(settings['templateHeader']), int(settings['startRow']), prepared['target'], result)
                    self.send(data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename='semin-produits.xlsx')
        except (ValueError, KeyError, TypeError) as error:
            self.send({'error': str(error)}, status=400)
        except Exception:
            self.send({'error': 'Impossible de lire le fichier. Vérifiez qu’il s’agit d’un classeur .xlsx valide, non chiffré.'}, status=400)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SEMIN Marketplace Template Manager')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--open-browser', action='store_true', help='Ouvrir le navigateur local')
    args = parser.parse_args()
    print(f'SEMIN : ouvrez http://127.0.0.1:{args.port} — Ctrl+C pour arrêter.', flush=True)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    if args.open_browser:
        import webbrowser
        threading.Timer(0.5, lambda: webbrowser.open(f'http://127.0.0.1:{args.port}')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Application arrêtée.')
    finally:
        server.server_close()
