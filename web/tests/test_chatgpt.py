"""V3.2 manual workflow. Public fixtures are fictional, including identifiers."""
import json
import unittest
import test_onebase_castorama as base

class ChatGPTTests(unittest.TestCase):
    setUpClass=classmethod(base.OneBaseCastoramaTests.setUpClass.__func__)
    tearDownClass=classmethod(base.OneBaseCastoramaTests.tearDownClass.__func__)
    setUp=base.OneBaseCastoramaTests.setUp
    tearDown=base.OneBaseCastoramaTests.tearDown
    nav=base.OneBaseCastoramaTests.nav
    analyse=base.OneBaseCastoramaTests.analyse
    source=base.OneBaseCastoramaTests.source
    save=base.OneBaseCastoramaTests.save
    product=base.OneBaseCastoramaTests.product
    template=base.OneBaseCastoramaTests.template
    upload=base.OneBaseCastoramaTests.upload
    check=base.OneBaseCastoramaTests.check
    def setup_product(self):
        self.product();self.nav('chatgpt');self.page.wait_for_function("() => document.querySelector('#gpt-product').options.length===2")
        self.id=self.page.evaluate('CatalogueStore.read().then(d=>d.products[0].id)');self.page.locator('#gpt-product').select_option(self.id)
    def content(self,market='Castorama',title='Titre fictif SEO'):
        return {'schemaVersion':1,'marketplace':market,'sku':'FICTIF-001','titleSeo':title,'descriptionHtml':'<p>Description fictive à vérifier.</p>','arguments':['Argument fictif '+str(i) for i in range(1,6)],'keywords':['enduit fictif','support fictif'],'faqGeo':[{'question':'Quel support fictif ?','answer':'Consulter les supports de la source fictive.'}],'missingFields':['Rendement absent de la source']}
    def preview(self,content=None,market='Castorama'):
        self.page.locator('#gpt-market').select_option(market);self.page.locator('#gpt-json').fill(json.dumps(content or self.content(market),ensure_ascii=False));self.page.locator('#gpt-preview').tap()
    def confirm(self):
        self.page.locator('#gpt-consent').check();self.page.locator('#gpt-save').tap();self.page.wait_for_selector('#gpt-preview-panel',state='hidden');self.page.wait_for_function("() => document.querySelector('#notice').textContent.includes('Nouvelle version ChatGPT validée')")
    def test_market_prompts_source_separation_clipboard_and_no_remote_calls(self):
        self.setup_product();before=self.page.evaluate('CatalogueStore.read()')
        self.page.evaluate("window.clipboardCaptured='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.clipboardCaptured=text}},configurable:true})")
        for market in ['Amazon','Castorama','ManoMano']:
            self.page.locator('#gpt-market').select_option(market);self.page.locator('#gpt-prepare').tap();self.page.wait_for_function("() => !document.querySelector('#gpt-copy').disabled")
            prompt=self.page.locator('#gpt-prompt').input_value();self.assertIn(market,prompt);self.assertIn('FICTIF-001',prompt);self.assertIn('000000000-00001',prompt);self.assertIn('GEO',prompt);self.assertIn('missingFields',prompt);self.assertIn('FAQ',prompt);self.assertIn('Ne jamais inventer',prompt)
            self.page.locator('#gpt-copy').tap();self.page.wait_for_function("() => window.clipboardCaptured===document.querySelector('#gpt-prompt').value")
        self.assertEqual(self.page.evaluate('CatalogueStore.read()'),before);self.assertEqual(self.requests,[self.url])
    def test_preview_consent_versioning_and_original_contents_preserved(self):
        self.setup_product();before=self.page.evaluate('CatalogueStore.read()')['products'][0]
        self.preview();self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.assertTrue(self.page.locator('#gpt-save').is_disabled());self.assertIn('Rendement',self.page.locator('#gpt-missing').text_content());self.assertEqual(self.page.evaluate('CatalogueStore.read().then(d=>d.products[0])'),before)
        self.confirm();self.page.wait_for_function("() => document.querySelector('#gpt-history').textContent.includes('Version 1')")
        self.preview(self.content(title='Deuxième titre fictif'));self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.confirm()
        saved=self.page.evaluate('CatalogueStore.read()')['products'][0];self.assertEqual(len(saved['dossier']['chatgpt']['Castorama']),2)
        self.assertEqual(saved['values'],before['values']);self.assertEqual(saved['dossier']['source'],before['dossier']['source']);self.assertEqual(saved['dossier']['enrichment'],before['dossier']['enrichment']);self.assertEqual(saved['dossier']['castorama'],before['dossier']['castorama'])
        self.assertEqual(saved['dossier']['chatgpt']['Castorama'][0]['content']['titleSeo'],'Titre fictif SEO')
        self.page.reload();self.nav('chatgpt');self.page.locator('#gpt-product').select_option(self.id);self.page.locator('#gpt-market').select_option('Castorama');self.assertIn('Version 2',self.page.locator('#gpt-history').text_content())
    def test_invalid_json_missing_fields_mismatch_and_html_rejected_atomically(self):
        self.setup_product();before=self.page.evaluate('CatalogueStore.read()')
        bad=["not json",'```json\n{}\n```','null','[]','{"schemaVersion":1}']
        for value in bad:
            self.page.locator('#gpt-json').fill(value);self.page.locator('#gpt-preview').tap();self.page.wait_for_function("() => document.querySelector('#gpt-errors').textContent.length>0");self.assertTrue(self.page.locator('#gpt-preview-panel').is_hidden());self.assertTrue(self.page.locator('#gpt-errors').text_content())
        for key,value in [('sku','OTHER'),('marketplace','Amazon'),('arguments',['Only one']),('keywords',[]),('faqGeo',[]),('descriptionHtml','<img src="https://example.invalid/x" onerror="alert(1)">')]:
            c=self.content();c[key]=value;self.preview(c);self.page.wait_for_function("() => document.querySelector('#gpt-errors').textContent.length>0");self.assertTrue(self.page.locator('#gpt-preview-panel').is_hidden());self.assertTrue(self.page.locator('#gpt-errors').text_content())
        self.assertEqual(self.page.evaluate('CatalogueStore.read()'),before);self.assertEqual(self.requests,[self.url])
    def test_changed_json_market_and_stale_catalogue_invalidate_consent(self):
        self.setup_product();self.preview();self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.page.locator('#gpt-consent').check();self.page.locator('#gpt-json').fill('{}');self.assertTrue(self.page.locator('#gpt-save').is_disabled());self.assertTrue(self.page.locator('#gpt-preview-panel').is_hidden())
        self.preview();self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.page.locator('#gpt-market').select_option('Amazon');self.assertTrue(self.page.locator('#gpt-save').is_disabled())
        result=self.page.evaluate('(c)=>CatalogueStore.read().then(d=>{try{ChatGPTWorkflow.apply(d,d.products[0].id,"Castorama",c,d.revision-1,true);return false}catch{return true}})',self.content());self.assertTrue(result)
        self.assertTrue(self.page.evaluate('(c)=>CatalogueStore.read().then(d=>{try{ChatGPTWorkflow.apply(d,d.products[0].id,"Castorama",c,d.revision,false);return false}catch{return true}})',self.content()))
    def test_market_isolation_backup_restore_and_onebase_edits_preserve_versions(self):
        self.setup_product();self.preview();self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.confirm();self.preview(self.content('Amazon'),'Amazon');self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.confirm()
        result=self.page.evaluate('CatalogueStore.read().then(d=>{const restored=CatalogueModel.restore(CatalogueModel.empty(),CatalogueModel.backup(d));const p=d.products[0];const plan=ProductWorkflow.plan(d,null,p.values,p.dossier.enrichment,p.dossier.castorama,p.id);return {restored:restored.products[0].dossier.chatgpt,edited:ProductWorkflow.apply(d,plan).products[0].dossier.chatgpt,original:p.dossier.chatgpt}})')
        self.assertEqual(result['restored'],result['original']);self.assertEqual(result['edited'],result['original']);self.assertEqual(set(result['original']),{'Amazon','Castorama'})
    def test_validated_contents_map_to_excel_and_export_needs_human_consent(self):
        self.setup_product();self.preview();self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.confirm();self.upload(self.template())
        self.page.get_by_label('Mapping Castorama · Nom',exact=True).select_option('chatgpt.Castorama.titleSeo')
        self.page.get_by_label('Mapping Castorama · Texte description',exact=True).select_option('chatgpt.Castorama.descriptionHtml')
        self.page.locator('#cast-check').tap();self.page.wait_for_function("() => document.querySelector('#cast-review-message').textContent.includes('Contrôle réussi')")
        self.assertTrue(self.page.locator('#cast-export').is_disabled());self.page.locator('#cast-export-consent').check();self.assertFalse(self.page.locator('#cast-export').is_disabled())
        path=base.OneBaseCastoramaTests.download(self)
        from openpyxl import load_workbook
        wb=load_workbook(path);self.assertEqual(wb['Data']['C3'].value,'Titre fictif SEO');self.assertEqual(wb['Data']['D3'].value,'<p>Description fictive à vérifier.</p>');self.assertTrue(self.page.locator('#cast-export').is_disabled());self.assertEqual(self.requests,[self.url])
    def test_mobile_layout_and_bad_archive_rejected(self):
        self.setup_product();self.preview();self.page.wait_for_selector('#gpt-preview-panel:not([hidden])');self.page.set_viewport_size({'width':412,'height':915});self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.assertTrue(self.page.evaluate('CatalogueStore.read().then(d=>{d.products[0].dossier.chatgpt={Unknown:[]};try{CatalogueModel.validateSnapshot(d);return false}catch{return true}})'))

if __name__=='__main__':unittest.main()
