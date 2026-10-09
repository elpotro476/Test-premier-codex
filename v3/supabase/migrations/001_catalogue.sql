-- Apply once, in order, as database administrator. No business data or account seeds.
begin;
create schema if not exists semin_private;
revoke all on schema semin_private from public, anon, authenticated;
grant usage on schema semin_private to authenticated;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check (length(btrim(name)) between 1 and 150),
 created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('admin','editor','reader')),
 primary key (organization_id,user_id)
);
create function semin_private.workspace_role(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
 select m.role from public.memberships m where m.organization_id=p_org and m.user_id=auth.uid()
$$;
revoke all on function semin_private.workspace_role(uuid) from public;
grant execute on function semin_private.workspace_role(uuid) to authenticated;

create table public.families (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null check (length(btrim(code)) between 1 and 100), label text not null,
 parent_id uuid, unique(organization_id,id), unique(organization_id,code),
 foreign key (organization_id,parent_id) references public.families(organization_id,id), check(parent_id is distinct from id)
);
create function semin_private.valid_ean13(s text) returns boolean
language sql immutable strict set search_path = '' as $$
 select case when s ~ '^[0-9]{13}$' then
 (select sum(substr(s,i,1)::int * case when i % 2 = 0 then 3 else 1 end) from generate_series(1,12) i)
 % 10 = (10-substr(s,13,1)::int) % 10 else false end
$$;
create table public.products (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 sku text not null check(length(btrim(sku)) between 1 and 100 and sku=btrim(sku)),
 ean text check(ean is null or semin_private.valid_ean13(ean)),
 designation text not null check(length(btrim(designation)) between 1 and 500),
 brand text not null check(length(btrim(brand)) between 1 and 150), family_id uuid,
 commercial_title text not null default '' check(length(commercial_title)<=500),
 short_description text not null default '' check(length(short_description)<=5000),
 long_description text not null default '' check(length(long_description)<=100000),
 technical_description text not null default '' check(length(technical_description)<=100000),
 dimensions text not null default '' check(length(dimensions)<=500),
 weight_kg numeric(14,4) check(weight_kg>=0 and weight_kg <> 'NaN'::numeric),
 packaging text not null default '' check(length(packaging)<=500),
 pack_quantity integer check(pack_quantity>0), variant_of uuid,
 status text not null default 'draft' check(status in ('draft','review','ready')),
 archived_at timestamptz, revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
 unique(organization_id,id), foreign key(organization_id,family_id) references public.families(organization_id,id),
 foreign key(organization_id,variant_of) references public.products(organization_id,id),
 check(variant_of is distinct from id)
);
create unique index products_sku_unique on public.products(organization_id,lower(sku));
create unique index products_ean_unique on public.products(organization_id,ean) where ean is not null;
create index products_catalogue_idx on public.products(organization_id,archived_at,sku,id);

create table public.attribute_definitions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null, label text not null, data_type text not null check(data_type in ('text','number','boolean','choice','date')),
 unit text, allowed_values jsonb check(allowed_values is null or jsonb_typeof(allowed_values)='array'),
 family_id uuid, required boolean not null default false,
 unique(organization_id,id), unique(organization_id,code),
 foreign key(organization_id,family_id) references public.families(organization_id,id)
);
create table public.product_attribute_values (
 organization_id uuid not null, product_id uuid not null, attribute_id uuid not null, value jsonb not null,
 primary key(organization_id,product_id,attribute_id),
 foreign key(organization_id,product_id) references public.products(organization_id,id),
 foreign key(organization_id,attribute_id) references public.attribute_definitions(organization_id,id)
);
create table public.audit_events (
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id),
 actor_id uuid references auth.users(id), at timestamptz not null default now(),
 entity text not null, entity_id uuid not null, action text not null, before_data jsonb, after_data jsonb
);
create function semin_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_events(organization_id,actor_id,entity,entity_id,action,before_data,after_data)
 values(new.organization_id,auth.uid(),TG_TABLE_NAME,
 case when TG_TABLE_NAME='products' then (to_jsonb(new)->>'id')::uuid else (to_jsonb(new)->>'user_id')::uuid end,
 TG_OP,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
create trigger products_audit after insert or update on public.products for each row execute function semin_private.audit_change();
create trigger memberships_audit after insert or update on public.memberships for each row execute function semin_private.audit_change();
revoke all on all functions in schema semin_private from public;
grant execute on function semin_private.workspace_role(uuid) to authenticated;
-- CHECK expressions also run under the invoker's permissions on SELECT / administrative writes.
grant execute on function semin_private.valid_ean13(text) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.families enable row level security;
alter table public.products enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.product_attribute_values enable row level security;
alter table public.audit_events enable row level security;
create policy organization_read on public.organizations for select to authenticated using(semin_private.workspace_role(id) is not null);
create policy memberships_read on public.memberships for select to authenticated using(user_id=auth.uid() or semin_private.workspace_role(organization_id)='admin');
create policy families_read on public.families for select to authenticated using(semin_private.workspace_role(organization_id) is not null);
create policy products_read on public.products for select to authenticated using(semin_private.workspace_role(organization_id) is not null);
create policy attributes_read on public.attribute_definitions for select to authenticated using(semin_private.workspace_role(organization_id) is not null);
create policy values_read on public.product_attribute_values for select to authenticated using(semin_private.workspace_role(organization_id) is not null);
create policy audit_read on public.audit_events for select to authenticated using(semin_private.workspace_role(organization_id) in ('admin','editor'));
revoke all on public.organizations,public.memberships,public.families,public.products,public.attribute_definitions,public.product_attribute_values,public.audit_events from public,anon,authenticated;
grant select on public.organizations,public.memberships,public.families,public.products,public.attribute_definitions,public.product_attribute_values,public.audit_events to authenticated;
revoke all on sequence public.audit_events_id_seq from public,anon,authenticated;
commit;
