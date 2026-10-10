"""Synthetic full fiches only; no commercial identifiers or private catalogues."""
import unittest
import test_onebase_castorama as base

TEXT = '''ENDUIT FICTIF
Code produit: 000100130-00001
Marque: FICTIVE
Famille: Enduit
Composition: plâtre, carbonate de calcium et adjuvantsTemps de prise: 2 heuresUsage: intérieurConsommation: 0,4 à 2,5 kg/m² selon les travaux
Supports: supports fictifsApplication: appliquer avec une spatulePrécaution d'emploi: ne pas appliquer sur un support humide
Conditionnement: sacs de 5 et 25 kg
Désignation\tEAN\tSKU\tConditionnement
ENDUIT FICTIF-3\t5901234123457\tFICTIF-CE-005\tsac de 5 kg
ENDUIT FICTIF-4\t4006381333931\tFICTIF-CE-025\t1 sac de 25 kg'''

class VariantTests(unittest.TestCase):
    setUpClass=classmethod(base.OneBaseCastoramaTests.setUpClass.__func__)
    tearDownClass=classmethod(base.OneBaseCastoramaTests.tearDownClass.__func__)
    setUp=base.OneBaseCastoramaTests.setUp
    tearDown=base.OneBaseCastoramaTests.tearDown
    nav=base.OneBaseCastoramaTests.nav
    analyse=base.OneBaseCastoramaTests.analyse
    source=base.OneBaseCastoramaTests.source
    save=base.OneBaseCastoramaTests.save
    def test_glued_rubrics_and_ambiguous_variants(self):
        self.analyse(TEXT)
        for field,value in {'composition':'plâtre, carbonate de calcium et adjuvants','settingTime':'2 heures','usage':'intérieur','consumption':'0,4 à 2,5 kg/m² selon les travaux','application':'appliquer avec une spatule','precautions':'ne pas appliquer sur un support humide'}.items():
            self.assertEqual(self.source(field).input_value(),value)
        for field in ['sku','ean','packaging','weight','units']:
            self.assertEqual(self.source(field).input_value(),'')
        self.assertIn('plusieurs variantes',self.page.locator('#ob-warnings').inner_text())
        self.assertEqual(self.source('genericPackaging').input_value(),'sacs de 5 et 25 kg')
    def test_select_variant_preview_save_and_preserve_raw(self):
        self.analyse(TEXT)
        self.page.locator('#ob-variant').select_option('FICTIF-CE-005')
        for field,value in {'sku':'FICTIF-CE-005','ean':'5901234123457','designation':'ENDUIT FICTIF-3','packaging':'sac de 5 kg','packagingType':'sac','weight':'5','units':''}.items():
            self.assertEqual(self.source(field).input_value(),value)
        self.source('ean').locator('..').locator('summary').click()
        self.assertIn('5901234123457',self.source('ean').locator('..').inner_text())
        self.assertEqual(self.page.evaluate('async () => (await CatalogueStore.read()).products.length'),0)
        self.save()
        before=self.page.evaluate('async () => (await CatalogueStore.read()).products[0]')
        self.assertEqual(before['dossier']['source']['raw'],TEXT)
        self.page.reload();self.nav('onebase')
        after=self.page.evaluate('async () => (await CatalogueStore.read()).products[0]')
        self.assertEqual(before,after)
    def test_single_row_and_explicit_quantity(self):
        self.analyse(TEXT.rsplit('\n',1)[0].replace('sac de 5 kg','1 sac de 5 kg'))
        self.assertEqual(self.source('sku').input_value(),'FICTIF-CE-005')
        self.assertEqual(self.source('units').input_value(),'1')
    def test_identifier_conflict_and_missing_table_identifiers(self):
        result=self.page.evaluate('(raw) => OneBase.parse(raw)',TEXT+'\nEAN: 1111111111111')
        self.assertEqual(result['extracted']['sku'],'')
        result=self.page.evaluate('(raw) => OneBase.parse(raw)',TEXT.split('Désignation\t')[0])
        self.assertEqual(result['extracted']['sku'],'')
        self.assertEqual(result['extracted']['ean'],'')
    def test_pipe_and_semicolon_tables(self):
        for separator in [' | ', ';']:
            result=self.page.evaluate('(raw) => OneBase.parse(raw)',TEXT.rsplit('\n',1)[0].replace('\t',separator))
            self.assertEqual(result['extracted']['sku'],'FICTIF-CE-005')
            self.assertEqual(result['extracted']['ean'],'5901234123457')
    def test_vertical_table_copy(self):
        raw=TEXT.rsplit('\n',1)[0].replace('\t','\n')
        result=self.page.evaluate('(raw) => OneBase.parse(raw)',raw)
        self.assertEqual(result['extracted']['sku'],'FICTIF-CE-005')
        self.assertEqual(result['extracted']['weight'],'5')
        self.assertIn('5901234123457',result['evidence']['ean'][0])
    def test_single_space_table(self):
        result=self.page.evaluate('(raw) => OneBase.parse(raw)',TEXT.rsplit('\n',1)[0].replace('\t',' '))
        self.assertEqual(result['extracted']['sku'],'FICTIF-CE-005')
        self.assertEqual(result['extracted']['weight'],'5')
    def test_label_suffix_inside_prose_is_not_a_rubric(self):
        result=self.page.evaluate('(raw) => OneBase.parse(raw)','PRODUIT FICTIF\nComposition: carbonate, surprise: donnée littérale\nSKU: FICTIF-001')
        self.assertEqual(result['extracted']['composition'],'carbonate, surprise: donnée littérale')
        self.assertEqual(result['extracted']['settingTime'],'')
