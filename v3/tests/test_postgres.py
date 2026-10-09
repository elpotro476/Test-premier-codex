"""Real PostgreSQL authorization/constraint tests. Run only against the dedicated test DB.

Supabase Auth/PostgREST are represented by role + verified-subject session variables.
This is not an integration test of hosted Supabase authentication.
"""
import os
from pathlib import Path
import shlex
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
ORG='10000000-0000-4000-8000-000000000001'
OTHER='10000000-0000-4000-8000-000000000002'
ADMIN='20000000-0000-4000-8000-000000000001'
EDITOR='20000000-0000-4000-8000-000000000002'
READER='20000000-0000-4000-8000-000000000003'
OUTSIDER='20000000-0000-4000-8000-000000000004'
PRODUCT='30000000-0000-4000-8000-000000000001'

def command(sql):
    cmd=shlex.split(os.environ.get('SEMIN_PSQL','psql -X -U postgres -d semin_v3_test'))+['-v','ON_ERROR_STOP=1','-A','-t','-q']
    return subprocess.run(cmd,input=sql,text=True,capture_output=True)

class PostgreSQLTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r=command('select current_database();')
        if r.returncode or r.stdout.strip()!='semin_v3_test':
            raise RuntimeError('Dedicated semin_v3_test PostgreSQL database required: '+r.stderr)
        # Non-destructive schema validation. Migrations must be applied by the test harness first.
        r=command("select 'public.products'::regclass;")
        if r.returncode:raise RuntimeError(r.stderr)

    def run_as(self,sql,user=EDITOR,role='authenticated'):
        seed=f"""
        begin;
        insert into auth.users values ('{ADMIN}'),('{EDITOR}'),('{READER}'),('{OUTSIDER}');
        insert into public.organizations(id,name) values ('{ORG}','Espace fictif A'),('{OTHER}','Espace fictif B');
        insert into public.memberships values ('{ORG}','{ADMIN}','admin'),('{ORG}','{EDITOR}','editor'),('{ORG}','{READER}','reader'),('{OTHER}','{OUTSIDER}','admin');
        insert into public.products(id,organization_id,sku,ean,designation,brand) values
          ('{PRODUCT}','{ORG}','FAKE-001','4006381333931','Produit fictif','Marque fictive'),
          (gen_random_uuid(),'{OTHER}','FAKE-001','4006381333931','Autre espace fictif','Fictif');
        set local role {role};
        select set_config('request.jwt.claim.sub','{user if role!='anon' else ''}',true);
        {sql}
        rollback;
        """
        return command(seed)
    def ok(self,sql,user=EDITOR):
        r=self.run_as(sql,user);self.assertEqual(r.returncode,0,r.stderr);return r.stdout.strip().splitlines()
    def denied(self,sql,user=EDITOR,contains=None,role='authenticated'):
        r=self.run_as(sql,user,role);self.assertNotEqual(r.returncode,0,'Operation should have been rejected')
        if contains:self.assertIn(contains,r.stderr)
    def save(self,patch,revision=1,product=PRODUCT):
        import json
        payload=json.dumps(patch).replace("'","''")
        return f"select (public.save_product('{ORG}',{'NULL' if product is None else repr(product)},{'NULL' if revision is None else revision},'{payload}'::jsonb)).id;"

    def test_anonymous_has_no_catalogue_or_rpc_access(self):
        self.denied('select * from public.products;',role='anon',contains='permission denied')
        self.denied(self.save({'designation':'Fictif'}),role='anon',contains='permission denied')
    def test_rls_reader_and_outsider_only_see_own_workspace(self):
        self.assertEqual(self.ok('select count(*) from public.products;',READER)[-1],'1')
        self.assertEqual(self.ok(f"select count(*) from public.products where organization_id='{ORG}';",OUTSIDER)[-1],'0')
        self.assertEqual(self.ok('select count(*) from public.audit_events;',READER)[-1],'0')
        self.denied(self.save({'designation':'Fictif'}),OUTSIDER,contains='Accès en écriture refusé')
    def test_reader_cannot_write_archive_or_promote(self):
        self.denied(self.save({'designation':'Fictif'}),READER,contains='Accès en écriture refusé')
        self.denied(f"select public.set_product_archived('{ORG}','{PRODUCT}',1,true);",READER)
        self.denied(f"select public.set_member_role('{ORG}','{READER}','admin');",READER)
    def test_no_direct_mutation_or_audit_tampering_even_admin(self):
        for sql in ["update public.products set brand='Fictif';",'delete from public.products;',"update public.memberships set role='admin';",'delete from public.audit_events;',"insert into public.organizations(name) values ('Fictif');"]:
            with self.subTest(sql=sql):self.denied(sql,ADMIN,contains='permission denied')
    def test_create_nullable_ean_patch_preserves_other_fields_and_audit(self):
        result=self.ok(self.save({'sku':'FAKE-002','ean':'','designation':'Nouveau fictif','brand':'Fictif'},None,None)+self.save({'designation':'Modifié fictif'})+f"select sku||'|'||designation||'|'||brand||'|'||revision from public.products where id='{PRODUCT}'; select count(*) from public.audit_events where entity='products' and action='UPDATE'; select count(*) from public.products where ean is null;")
        self.assertIn('FAKE-001|Modifié fictif|Marque fictive|2',result);self.assertEqual(result[-2:],['1','1'])
    def test_stale_revision_rejects_update_and_archive(self):
        self.denied(self.save({'brand':'Fictif'})+self.save({'brand':'Écrasement fictif'}),contains='Conflit de révision')
        self.denied(self.save({'brand':'Fictif'})+f"select public.set_product_archived('{ORG}','{PRODUCT}',1,true);",contains='Conflit de révision')
    def test_reserved_keys_duplicate_sku_ean_invalid_numbers(self):
        for patch,product,rev in [({'organization_id':OTHER},PRODUCT,1),({'revision':99},PRODUCT,1),({'sku':'fake-001','designation':'Fictif','brand':'Fictif'},None,None),({'sku':'FAKE-002','ean':'4006381333931','designation':'Fictif','brand':'Fictif'},None,None),({'ean':'1234567890123'},PRODUCT,1),({'weight_kg':-1},PRODUCT,1),({'pack_quantity':0},PRODUCT,1)]:
            with self.subTest(patch=patch):self.denied(self.save(patch,rev,product))
    def test_archive_restore_keeps_identifiers_reserved(self):
        result=self.ok(f"select (public.set_product_archived('{ORG}','{PRODUCT}',1,true)).revision;select (public.set_product_archived('{ORG}','{PRODUCT}',2,false)).revision;")
        self.assertEqual(result[-2:],['2','3'])
        self.denied(f"select public.set_product_archived('{ORG}','{PRODUCT}',1,true);"+self.save({'brand':'Fictif'},2),contains='Restaurez')
        self.denied(f"select public.set_product_archived('{ORG}','{PRODUCT}',1,true);"+self.save({'sku':'FAKE-001','brand':'Fictif','designation':'Fictif'},None,None))
    def test_admin_roles_no_escalation_last_admin_and_revocation(self):
        self.denied(f"select public.set_member_role('{ORG}','{EDITOR}','admin');",EDITOR,contains='Administration refusée')
        self.denied(f"select public.set_member_role('{ORG}','{ADMIN}','reader');",ADMIN,contains='Conservez')
        self.ok(f"select public.set_member_role('{ORG}','{OUTSIDER}','reader');select public.set_member_role('{ORG}','{READER}','admin');",ADMIN)
        self.denied(f"select public.set_member_role('{ORG}','{EDITOR}','reader');select set_config('request.jwt.claim.sub','{EDITOR}',true);"+self.save({'brand':'Fictif'}),ADMIN,contains='Accès en écriture refusé')
    def test_cross_workspace_family_and_variant_are_rejected(self):
        self.denied(self.save({'family_id':OTHER}))
        self.denied(self.save({'variant_of':PRODUCT}),contains='Parent de variante invalide')
        self.denied(self.save({'variant_of':OTHER}),contains='Parent de variante invalide')
    def test_parent_archive_and_restore_order(self):
        sql=self.save({'sku':'FAKE-VARIANT','designation':'Variante fictive','brand':'Fictif','variant_of':PRODUCT},None,None)
        self.denied(sql+f"select public.set_product_archived('{ORG}','{PRODUCT}',1,true);",contains='Archivez les variantes')

    def test_authenticated_role_without_verified_subject_cannot_write(self):
        self.denied(self.save({'brand':'Fictif'}),user='',contains='Accès en écriture refusé')

    def test_all_tables_use_rls_and_definer_functions_pin_search_path(self):
        self.assertEqual(self.ok("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('organizations','memberships','families','products','attribute_definitions','product_attribute_values','audit_events') and c.relrowsecurity;")[-1],'7')
        result=command("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','semin_private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=\"\"'],false);")
        self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(result.stdout.strip(),'0')

    def test_two_connections_cannot_overwrite_same_revision(self):
        from concurrent.futures import ThreadPoolExecutor
        org='10000000-0000-4000-8000-000000000009'
        user='20000000-0000-4000-8000-000000000009'
        product='30000000-0000-4000-8000-000000000009'
        seed=command(f"begin;insert into auth.users values ('{user}');insert into public.organizations(id,name) values ('{org}','Concurrence fictive');insert into public.memberships values ('{org}','{user}','editor');insert into public.products(id,organization_id,sku,designation,brand) values ('{product}','{org}','FICTIF-CONCURRENT','Fictif','Fictif');commit;")
        self.assertEqual(seed.returncode,0,seed.stderr)
        try:
            def write(label):
                return command(f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{user}',true);select (public.save_product('{org}','{product}',1,'{{\"designation\":\"Fictif {label}\"}}')).revision;commit;")
            with ThreadPoolExecutor(max_workers=2) as pool:
                results=list(pool.map(write,['A','B']))
            self.assertEqual(sum(r.returncode==0 for r in results),1,[r.stderr for r in results])
            self.assertIn('Conflit de révision',next(r.stderr for r in results if r.returncode))
            self.assertEqual(command(f"select revision from public.products where id='{product}';select count(*) from public.audit_events where entity_id='{product}' and action='UPDATE';").stdout.strip().splitlines(),['2','1'])
        finally:
            cleanup=command(f"begin;delete from public.audit_events where organization_id='{org}';delete from public.products where organization_id='{org}';delete from public.memberships where organization_id='{org}';delete from public.organizations where id='{org}';delete from auth.users where id='{user}';commit;")
            self.assertEqual(cleanup.returncode,0,cleanup.stderr)

if __name__=='__main__':unittest.main()
