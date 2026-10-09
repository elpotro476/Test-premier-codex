import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
API='https://fictitious-project.supabase.co'
ORG='10000000-0000-4000-8000-000000000001'
USER='20000000-0000-4000-8000-000000000001'
PRODUCT='30000000-0000-4000-8000-000000000001'

class FrontendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.root=Path(cls.temp.name)
        config=cls.root/'config.json';config.write_text(json.dumps({'url':API,'publicKey':'sb_publishable_FICTITIOUS_12345678901234567890'}))
        for name,cfg in [('demo',None),('central',config)]:
            subprocess.run(['node',str(ROOT/'build.mjs')]+([str(cfg)] if cfg else []),env={**os.environ,'SEMIN_V3_BUILD_DIR':str(cls.root/name)},check=True,capture_output=True)
        class Handler(SimpleHTTPRequestHandler):
            def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(cls.root),**kwargs)
            def log_message(self,*args):pass
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.play=sync_playwright().start();options={'headless':True}
        if os.environ.get('SEMIN_TEST_CHROMIUM'):options['executable_path']=os.environ['SEMIN_TEST_CHROMIUM']
        cls.browser=cls.play.chromium.launch(**options);cls.base=f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.play.stop();cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':820,'height':1180},has_touch=True)
        self.page=self.context.new_page();self.requests=[];self.page.on('request',lambda r:self.requests.append(r.url));self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)))
    def tearDown(self):
        self.assertEqual(self.errors,[]);self.context.close()
    def demo(self):
        self.page.goto(self.base+'/demo/index.html');self.page.locator('#demo').tap();self.page.wait_for_selector('#workspace:not([hidden])')
    def create(self,sku='FICTIF-002'):
        self.page.locator('#create').tap();self.page.get_by_label('SKU',exact=True).fill(sku);self.page.get_by_label('Désignation',exact=True).fill('Nouveau produit fictif');self.page.get_by_label('Marque',exact=True).fill('Marque fictive');self.page.locator('#save').tap();self.page.wait_for_selector('#editor',state='hidden')
    def mock(self,role='editor',login_fail=False,expired=False,short_lived=False):
        self.calls=[];self.db=[dict(id=PRODUCT,sku='FICTIF-CENTRAL',ean=None,designation='Fiche fictive centrale',brand='Fictif',revision=1,status='draft',updated_at='2026-10-09T10:00:00Z',archived_at=None)]
        def route(r):
            req=r.request;self.calls.append((req.url,req.method,req.headers,req.post_data_json if req.method=='POST' and req.post_data else None))
            data=[];status=200;headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':f'0-0/{len(self.db)}'}
            if req.method=='OPTIONS':r.fulfill(status=204,headers={**headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'});return
            if '/auth/v1/token' in req.url:
                if login_fail:status=400;data={'error_code':'invalid_credentials'}
                else:data={'access_token':'FICTITIOUS_ACCESS_TOKEN','refresh_token':'FICTITIOUS_REFRESH_TOKEN','expires_in':1 if short_lived and 'grant_type=password' in req.url else 3600,'user':{'id':USER,'email':'fiction@example.invalid'}}
            elif '/auth/v1/logout' in req.url:data={}
            elif expired:status=401;data={'code':'PGRST301'}
            elif '/organizations?' in req.url:data=[{'id':ORG,'name':'Espace fictif'}]
            elif '/memberships?' in req.url:data=[{'user_id':USER,'role':role}]
            elif '/families?' in req.url:data=[]
            elif '/audit_events?' in req.url:data=[]
            elif '/products?' in req.url:data=self.db
            elif '/rpc/save_product' in req.url:
                body=req.post_data_json
                if body['p_expected_revision']!=self.db[0]['revision']:status=409;data={'code':'40001'}
                elif role=='reader':status=403;data={'code':'42501'}
                else:self.db[0].update(body['p_patch']);self.db[0]['revision']+=1;data=self.db[0]
            r.fulfill(status=status,headers=headers,body=json.dumps(data))
        self.page.route(API+'/**',route);self.page.goto(self.base+'/central/index.html')
    def login(self):
        self.page.locator('#email').fill('fiction@example.invalid');self.page.locator('#password').fill('FICTITIOUS_TEST_PASSWORD');self.page.locator('#login').tap()
    def test_demo_touch_crud_archive_restore_search_and_no_network(self):
        self.demo();self.create();self.page.locator('#search').fill('FICTIF-002');self.page.locator('#search-button').tap();self.page.wait_for_selector('#count:text-is("1 fiche(s) · page 1 · 50 fiches par page")')
        self.page.get_by_role('button',name='Ouvrir FICTIF-002',exact=True).tap();self.page.get_by_label('Désignation',exact=True).fill('Fiche fictive revue');self.page.locator('#save').tap();self.page.wait_for_selector('#editor',state='hidden');self.assertIn('Fiche fictive revue',self.page.locator('#products').text_content())
        self.page.get_by_role('button',name='Ouvrir FICTIF-002',exact=True).tap();self.page.locator('#archive').tap();self.page.locator('#cancel-archive').tap();self.assertTrue(self.page.locator('#editor').is_visible());self.page.locator('#archive').tap();self.page.locator('#confirm-archive').tap();self.page.wait_for_selector('#editor',state='hidden');self.page.wait_for_selector('#count:text-is("0 fiche(s) · page 1 · 50 fiches par page")')
        self.page.locator('#archive-filter').select_option('archived');self.page.wait_for_selector('#count:text-is("1 fiche(s) · page 1 · 50 fiches par page")');self.page.get_by_role('button',name='Ouvrir FICTIF-002',exact=True).tap();self.assertTrue(self.page.locator('#save').is_hidden());self.page.locator('#archive').tap();self.page.locator('#confirm-archive').tap();self.page.wait_for_selector('#editor',state='hidden')
        self.assertEqual(self.requests,[self.base+'/demo/index.html']);self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.locator('#logout').tap();self.page.locator('#demo').tap();self.assertNotIn('FICTIF-002',self.page.locator('#products').text_content())
    def test_invalid_ean_and_duplicate_rejected_demo(self):
        self.demo();self.page.get_by_role('button',name='Ouvrir FICTIF-V3-001',exact=True).tap();self.page.get_by_label('EAN-13 (facultatif)',exact=True).fill('1234567890123');self.page.locator('#save').tap();self.page.wait_for_selector('#editor-message:text-matches("EAN-13 invalide")');self.page.locator('#close-editor').tap()
        self.page.locator('#create').tap();self.page.get_by_label('SKU',exact=True).fill('fictif-v3-001');self.page.get_by_label('Désignation',exact=True).fill('Fictif');self.page.get_by_label('Marque',exact=True).fill('Fictif');self.page.locator('#save').tap();self.page.wait_for_selector('#editor-message:text-is("SKU ou EAN déjà utilisé.")')
    def test_auth_gate_reader_permissions_no_tokens_persisted_logout(self):
        self.mock(role='reader');self.assertTrue(self.page.locator('#workspace').is_hidden());self.assertEqual(self.calls,[]);self.login();self.page.get_by_role('button',name='Ouvrir FICTIF-CENTRAL',exact=True).wait_for();self.assertTrue(self.page.locator('#create').is_hidden());self.assertTrue(self.page.locator('[data-view="members"]').is_hidden());self.page.get_by_role('button',name='Ouvrir FICTIF-CENTRAL',exact=True).tap();self.assertTrue(self.page.get_by_label('SKU',exact=True).is_disabled());self.assertTrue(self.page.locator('#save').is_hidden())
        rest=[c for c in self.calls if '/rest/' in c[0]];self.assertTrue(rest);self.assertTrue(all(c[2].get('authorization')=='Bearer FICTITIOUS_ACCESS_TOKEN' for c in rest))
        self.assertEqual(self.page.evaluate('Object.keys(localStorage)'),[]);self.assertEqual(self.page.evaluate('Object.keys(sessionStorage)'),[]);self.assertEqual(self.page.evaluate('indexedDB.databases().then(x=>x.length)'),0)
        self.page.locator('#close-editor').tap();self.page.locator('#logout').tap();self.page.wait_for_selector('#login-panel:not([hidden])');self.assertEqual(self.page.locator('#products').text_content(),'');self.assertIsNone(self.page.evaluate('V3Services.auth.current()'));self.assertEqual(self.page.locator('#password').input_value(),'')
    def test_authenticated_edit_uses_revision_and_conflict_does_not_close(self):
        self.mock();self.login();self.page.get_by_role('button',name='Ouvrir FICTIF-CENTRAL',exact=True).wait_for();self.page.get_by_role('button',name='Ouvrir FICTIF-CENTRAL',exact=True).tap();self.page.get_by_label('Désignation',exact=True).fill('Mise à jour fictive');self.page.locator('#save').tap();self.page.wait_for_selector('#editor',state='hidden')
        call=[c for c in self.calls if '/rpc/save_product' in c[0]][0];self.assertEqual(call[3]['p_expected_revision'],1);self.assertEqual(call[3]['p_product'],PRODUCT);self.assertEqual(call[3]['p_patch']['ean'],None)
        self.page.get_by_role('button',name='Ouvrir FICTIF-CENTRAL',exact=True).tap();self.db[0]['revision']=99;self.page.get_by_label('Marque',exact=True).fill('Fictif');self.page.locator('#save').tap();self.page.wait_for_selector('#editor-message:text-matches("autre appareil")');self.assertTrue(self.page.locator('#editor').is_visible())
    def test_bad_credentials_and_expired_auth_reveal_no_data(self):
        self.mock(login_fail=True);self.login();self.page.wait_for_selector('#message.error');self.assertTrue(self.page.locator('#workspace').is_hidden());self.assertFalse(any('/rest/' in c[0] for c in self.calls));self.assertIsNone(self.page.evaluate('V3Services.auth.current()'))
    def test_expired_token_clears_session_and_catalogue(self):
        self.mock(expired=True);self.login();self.page.wait_for_selector('#login-panel:not([hidden])');self.page.wait_for_selector('#message.error');self.assertIsNone(self.page.evaluate('V3Services.auth.current()'));self.assertEqual(self.page.locator('#products').text_content(),'')
    def test_refresh_uses_memory_token_and_reload_requires_login(self):
        self.mock(short_lived=True);self.login();self.page.get_by_role('button',name='Ouvrir FICTIF-CENTRAL',exact=True).wait_for()
        refresh=[c for c in self.calls if 'grant_type=refresh_token' in c[0]];self.assertEqual(len(refresh),1);self.assertEqual(refresh[0][3],{'refresh_token':'FICTITIOUS_REFRESH_TOKEN'})
        count=len(self.calls);self.page.reload();self.assertTrue(self.page.locator('#workspace').is_hidden());self.assertEqual(len(self.calls),count);self.assertIsNone(self.page.evaluate('V3Services.auth.current()'))
    def test_late_response_after_logout_cannot_repopulate_catalogue(self):
        self.mock();pending=[];self.page.route(API+'/rest/v1/products?**',lambda route:pending.append(route));self.login()
        self.page.wait_for_selector('#session:not([hidden])');self.page.wait_for_timeout(150);self.assertEqual(len(pending),1)
        self.page.locator('#logout').tap();pending[0].fulfill(status=200,headers={'content-type':'application/json','access-control-allow-origin':'*'},body=json.dumps(self.db));self.page.wait_for_timeout(100)
        self.assertTrue(self.page.locator('#workspace').is_hidden());self.assertEqual(self.page.locator('#products').text_content(),'');self.assertIsNone(self.page.evaluate('V3Services.auth.current()'))
    def test_build_rejects_privileged_key_and_csp_is_project_scoped(self):
        self.mock();csp=self.page.locator('meta[http-equiv="Content-Security-Policy"]').get_attribute('content');self.assertIn('connect-src '+API+';',csp);self.assertNotIn('https:;',csp)
        bad=Path(self.temp.name)/'secret.json';bad.write_text(json.dumps({'url':API,'publicKey':'sb_secret_invalid'}));r=subprocess.run(['node',str(ROOT/'build.mjs'),str(bad)],capture_output=True,text=True);self.assertNotEqual(r.returncode,0)
        self.context.set_default_timeout(5000);self.page.set_viewport_size({'width':412,'height':915});self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))

if __name__=='__main__':unittest.main()
