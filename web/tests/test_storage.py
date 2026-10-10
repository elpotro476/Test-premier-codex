"""Storage protection and persistence use disposable Chrome profiles only."""
import json
import os
from pathlib import Path
import unittest
import test_onebase_castorama as base

class StorageTests(unittest.TestCase):
    setUpClass=classmethod(base.OneBaseCastoramaTests.setUpClass.__func__)
    tearDownClass=classmethod(base.OneBaseCastoramaTests.tearDownClass.__func__)
    setUp=base.OneBaseCastoramaTests.setUp
    tearDown=base.OneBaseCastoramaTests.tearDown
    nav=base.OneBaseCastoramaTests.nav
    analyse=base.OneBaseCastoramaTests.analyse
    source=base.OneBaseCastoramaTests.source
    save=base.OneBaseCastoramaTests.save
    product=base.OneBaseCastoramaTests.product
    def test_empty_start_no_automatic_demos_and_android_settings(self):
        self.assertEqual(self.page.evaluate('CatalogueStore.read().then(d=>d.products.length)'),0)
        for size in [{'width':412,'height':915},{'width':1280,'height':720}]:
            self.page.set_viewport_size(size);self.page.locator('#open-settings').tap();self.page.wait_for_selector('#studio-parameters:not([hidden])')
            self.page.wait_for_function("() => document.querySelector('#storage-details').textContent.includes('version 2')")
            self.assertIn('Produits enregistrés : 0',self.page.locator('#storage-details').text_content())
            self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.reload();self.assertEqual(self.page.evaluate('CatalogueStore.read().then(d=>d.products.length)'),0)
    def test_backup_reads_latest_data_after_write_in_another_tab(self):
        self.product();self.nav('parameters');other=self.context.new_page();other.goto(self.url)
        other.evaluate('CatalogueStore.read().then(d=>{d.products[0].values.designation="Dernière modification fictive";return CatalogueStore.save(d,d.revision)})')
        with self.page.expect_download() as e:self.page.locator('#master-backup').tap()
        path=Path(self.temp.name)/'latest.json';e.value.save_as(path);backup=json.loads(path.read_text())
        self.assertEqual(backup['catalogue']['products'][0]['values']['designation'],'Dernière modification fictive')
        self.assertIn('raw',backup['catalogue']['products'][0]['dossier']['source']);other.close()
    def test_merge_preview_adds_only_new_products_and_keeps_sources_conflicts(self):
        self.product();before=self.page.evaluate('CatalogueStore.read()')
        backup=self.page.evaluate('CatalogueStore.read().then(d=>{const copy=structuredClone(d.products[0]);copy.id="new-fictional-id";copy.values.sku="NEW-FICTIVE";copy.values.ean="";d.products[0].dossier.source.raw="Conflicting synthetic text";d.products[0].values.designation="Do not overwrite";d.products.push(copy);return CatalogueModel.backup(d)})')
        path=Path(self.temp.name)/'merge.json';path.write_text(json.dumps(backup));self.nav('parameters');self.page.locator('#master-restore-file').set_input_files(path)
        self.page.wait_for_selector('#master-restore-preview:not([hidden])');self.assertIn('1 ajout(s)',self.page.locator('#master-restore-summary').text_content());self.assertIn('1 conflit(s)',self.page.locator('#master-restore-summary').text_content());self.assertTrue(self.page.locator('#master-restore').is_disabled())
        self.assertEqual(self.page.evaluate('CatalogueStore.read()'),before)
        self.page.locator('#master-restore-consent').check();self.page.locator('#master-restore').tap();self.page.wait_for_function("() => document.querySelector('#notice').textContent.includes('Sauvegarde fusionnée localement')")
        after=self.page.evaluate('CatalogueStore.read()');self.assertEqual(len(after['products']),2);self.assertEqual(after['products'][0],before['products'][0]);self.assertEqual(after['products'][1]['dossier']['source'],before['products'][0]['dossier']['source'])
    def test_merge_duplicates_attributes_and_stale_revision_never_overwrite(self):
        self.product()
        result=self.page.evaluate('CatalogueStore.read().then(d=>{const b=CatalogueModel.backup(d);const p=structuredClone(b.catalogue.products[0]);p.id="new";p.values.sku="NEW";p.values.ean="";b.catalogue.products.push(p);const dup=structuredClone(p);dup.id="other-new";b.catalogue.products.push(dup);const plan=CatalogueModel.mergePlan(d,b);let stale=false,consent=false;try{CatalogueModel.applyMerge({...d,revision:d.revision+1},plan,true)}catch{stale=true}try{CatalogueModel.applyMerge(d,plan,false)}catch{consent=true}return {adds:plan.items.filter(i=>i.status==="Ajout").length,stale,consent,original:d.products,merged:CatalogueModel.applyMerge(d,plan,true).products}})')
        self.assertEqual(result['adds'],0);self.assertTrue(result['stale']);self.assertTrue(result['consent']);self.assertEqual(result['merged'],result['original'])
        result=self.page.evaluate('CatalogueStore.read().then(d=>{const b=CatalogueModel.backup(d);b.catalogue.products[0].id="new";b.catalogue.products[0].values.sku="NEW";b.catalogue.products[0].values.ean="";b.catalogue.attributes.find(a=>a.id==="sku").type="number";return CatalogueModel.mergePlan(d,b).items[0].status})')
        self.assertEqual(result,'Conflit')
        result=self.page.evaluate('CatalogueStore.read().then(d=>{d.history=Array.from({length:100},(_,i)=>({id:String(i),at:"2026-01-01",type:"Historique fictif",count:1}));const merged=CatalogueModel.applyMerge(d,CatalogueModel.mergePlan(d,CatalogueModel.backup(d)),true);return JSON.stringify(merged.history)===JSON.stringify(d.history)})')
        self.assertTrue(result)
    def test_migration_preserves_v1_database_and_blocks_old_writer(self):
        c=self.browser.new_context();p=c.new_page();p.goto(self.url.rsplit('/',1)[0]+'/storage-seed-test')
        p.evaluate('async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("semin-marketplace-studio",1);r.onupgradeneeded=()=>r.result.createObjectStore("workspace");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const tx=db.transaction("workspace","readwrite");tx.objectStore("workspace").put({schemaVersion:1,revision:8,products:[],attributes:[],history:[]},"untouched-test-marker");tx.oncomplete=resolve;tx.onerror=reject});db.close()}')
        # A real, valid existing catalogue with original OneBase text is seeded
        # using only the public model, before running the new Store module.
        p.add_script_tag(content=Path('web/onebase-model.js').read_text());p.add_script_tag(content=Path('web/catalogue-model.js').read_text())
        seeded=p.evaluate('async()=>{const d=CatalogueModel.empty();d.revision=7;d.products.push({id:"old-fiction",values:{sku:"OLD-FICTIVE"},status:"À compléter",updatedAt:"2026-01-01",dossier:{version:1,source:{raw:"Unmodified original fictive source",extracted:{sku:"OLD-FICTIVE"},evidence:{},importedAt:"2026-01-01"},enrichment:{},castorama:{}}});const db=await new Promise(resolve=>{const r=indexedDB.open("semin-marketplace-studio",1);r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const tx=db.transaction("workspace","readwrite");tx.objectStore("workspace").put(d,"catalogue");tx.oncomplete=resolve});db.close();return d}')
        p.goto(self.url);self.assertEqual(p.evaluate('CatalogueStore.read()'),seeded)
        self.assertTrue(p.evaluate('async()=>new Promise(resolve=>{const r=indexedDB.open("semin-marketplace-studio",1);r.onerror=()=>resolve(r.error.name==="VersionError");r.onsuccess=()=>{r.result.close();resolve(false)}})'))
        self.assertEqual(p.evaluate('async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open("semin-marketplace-studio",2);r.onsuccess=()=>resolve(r.result)});const value=await new Promise(resolve=>{const r=db.transaction("workspace").objectStore("workspace").get("untouched-test-marker");r.onsuccess=()=>resolve(r.result)});db.close();return value.revision}'),8)
        c.close()
    def test_full_browser_restart_persists_catalogue_and_origin_separation(self):
        profile=Path(self.temp.name)/'persistent-profile';opts={'headless':True}
        if os.environ.get('SEMIN_TEST_CHROMIUM'):opts['executable_path']=os.environ['SEMIN_TEST_CHROMIUM']
        c=self.playwright.chromium.launch_persistent_context(str(profile),**opts);p=c.pages[0];p.goto(self.url)
        expected=p.evaluate('CatalogueStore.read().then(d=>{const p={id:"persistent-fiction",values:{sku:"PERSISTENT-FICTIVE"},status:"À compléter",updatedAt:"2026-01-01",dossier:{version:1,source:{raw:"Original fictional OneBase text",extracted:{sku:"PERSISTENT-FICTIVE"},evidence:{},importedAt:"2026-01-01"},enrichment:{},castorama:{}}};d.products.push(p);return CatalogueStore.save(d,d.revision)})');c.close()
        c=self.playwright.chromium.launch_persistent_context(str(profile),**opts);p=c.pages[0];p.goto(self.url)
        self.assertEqual(p.evaluate('CatalogueStore.read()'),expected)
        alternate=self.url.rsplit('/',1)[0]+'/alternate-app.html';p.route(alternate,lambda route:route.fulfill(content_type='text/html',body=Path('web/SEMIN-Marketplace.html').read_text()));p.goto(alternate);self.assertEqual(p.evaluate('CatalogueStore.read()'),expected)
        separated=self.url.replace('127.0.0.1','localhost');p.goto(separated);self.assertEqual(p.evaluate('CatalogueStore.read().then(d=>d.products.length)'),0)
        p.goto(self.url);self.assertEqual(p.evaluate('CatalogueStore.read()'),expected);c.close()

if __name__=='__main__':unittest.main()
