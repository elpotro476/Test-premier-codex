begin;
create function public.save_product(p_organization uuid,p_product uuid,p_expected_revision bigint,p_patch jsonb)
returns public.products language plpgsql security definer set search_path = '' as $$
declare old_row public.products; next_row public.products; k text;
begin
 perform 1 from public.organizations where id=p_organization for update;
 if auth.uid() is null or coalesce(semin_private.workspace_role(p_organization),'') not in ('admin','editor') then
  raise exception 'Accès en écriture refusé' using errcode='42501';
 end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Objet de modification attendu' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k not in ('sku','ean','designation','brand','family_id','commercial_title','short_description','long_description','technical_description','dimensions','weight_kg','packaging','pack_quantity','variant_of','status') then
   raise exception 'Champ non modifiable : %',k using errcode='22023';
  end if;
 end loop;
 if p_product is null then
  if p_expected_revision is not null then raise exception 'Révision inattendue pour une création' using errcode='22023'; end if;
  next_row := jsonb_populate_record(null::public.products,p_patch);
  next_row.id:=gen_random_uuid(); next_row.organization_id:=p_organization;
  next_row.commercial_title:=coalesce(next_row.commercial_title,'');
  next_row.short_description:=coalesce(next_row.short_description,''); next_row.long_description:=coalesce(next_row.long_description,'');
  next_row.technical_description:=coalesce(next_row.technical_description,''); next_row.dimensions:=coalesce(next_row.dimensions,'');
  next_row.packaging:=coalesce(next_row.packaging,''); next_row.status:=coalesce(next_row.status,'draft');
  next_row.revision:=1; next_row.created_at:=now(); next_row.created_by:=auth.uid();
 else
  select * into old_row from public.products where id=p_product and organization_id=p_organization for update;
  if not found then raise exception 'Fiche introuvable' using errcode='P0002'; end if;
  if p_expected_revision is distinct from old_row.revision then raise exception 'Conflit de révision : actualisez la fiche' using errcode='40001'; end if;
  if old_row.archived_at is not null then raise exception 'Restaurez la fiche avant modification' using errcode='22023'; end if;
  next_row:=jsonb_populate_record(old_row,p_patch);next_row.revision:=old_row.revision+1;
 end if;
 next_row.sku:=btrim(next_row.sku); next_row.ean:=nullif(btrim(next_row.ean),'');
 next_row.updated_at:=now(); next_row.updated_by:=auth.uid();
 -- One-level variants; organization lock prevents concurrent cycles / parent archival.
 if next_row.variant_of is not null then
  if next_row.variant_of=next_row.id or not exists(select 1 from public.products where organization_id=p_organization and id=next_row.variant_of and variant_of is null and archived_at is null)
   or exists(select 1 from public.products where organization_id=p_organization and variant_of=next_row.id) then
   raise exception 'Parent de variante invalide (un niveau, même espace, parent actif)' using errcode='22023';
  end if;
 end if;
 if p_product is null then insert into public.products select (next_row).* returning * into next_row;
 else
  update public.products set sku=next_row.sku,ean=next_row.ean,designation=next_row.designation,brand=next_row.brand,
   family_id=next_row.family_id,commercial_title=next_row.commercial_title,short_description=next_row.short_description,
   long_description=next_row.long_description,technical_description=next_row.technical_description,dimensions=next_row.dimensions,
   weight_kg=next_row.weight_kg,packaging=next_row.packaging,pack_quantity=next_row.pack_quantity,variant_of=next_row.variant_of,
   status=next_row.status,revision=next_row.revision,updated_at=next_row.updated_at,updated_by=next_row.updated_by
  where id=p_product and organization_id=p_organization returning * into next_row;
 end if;
 return next_row;
end $$;

create function public.set_product_archived(p_organization uuid,p_product uuid,p_expected_revision bigint,p_archived boolean)
returns public.products language plpgsql security definer set search_path = '' as $$
declare r public.products;
begin
 perform 1 from public.organizations where id=p_organization for update;
 if auth.uid() is null or coalesce(semin_private.workspace_role(p_organization),'') not in ('admin','editor') then raise exception 'Accès en écriture refusé' using errcode='42501'; end if;
 if p_archived is null then raise exception 'Choix d’archivage attendu' using errcode='22023'; end if;
 select * into r from public.products where organization_id=p_organization and id=p_product for update;
 if not found then raise exception 'Fiche introuvable' using errcode='P0002'; end if;
 if p_expected_revision is distinct from r.revision then raise exception 'Conflit de révision : actualisez la fiche' using errcode='40001'; end if;
 if p_archived and exists(select 1 from public.products where organization_id=p_organization and variant_of=p_product and archived_at is null) then
  raise exception 'Archivez les variantes actives avant leur parent' using errcode='22023';
 end if;
 if not p_archived and r.variant_of is not null and not exists(select 1 from public.products where organization_id=p_organization and id=r.variant_of and archived_at is null) then
  raise exception 'Restaurez le parent avant sa variante' using errcode='22023';
 end if;
 update public.products set archived_at=case when p_archived then now() else null end,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where organization_id=p_organization and id=p_product returning * into r;
 return r;
end $$;

create function public.set_member_role(p_organization uuid,p_user uuid,p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 -- Serialize changes before checking the role and last administrator.
 perform 1 from public.organizations where id=p_organization for update;
 if auth.uid() is null or semin_private.workspace_role(p_organization) is distinct from 'admin' then raise exception 'Administration refusée' using errcode='42501'; end if;
 if p_role is null or p_role not in ('admin','editor','reader') then raise exception 'Rôle invalide' using errcode='22023'; end if;
 if exists(select 1 from public.memberships where organization_id=p_organization and user_id=p_user and role='admin')
  and p_role<>'admin' and (select count(*) from public.memberships where organization_id=p_organization and role='admin')<=1 then
  raise exception 'Conservez au moins un administrateur' using errcode='22023';
 end if;
 insert into public.memberships values(p_organization,p_user,p_role)
 on conflict(organization_id,user_id) do update set role=excluded.role;
end $$;
revoke all on function public.save_product(uuid,uuid,bigint,jsonb),public.set_product_archived(uuid,uuid,bigint,boolean),public.set_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.save_product(uuid,uuid,bigint,jsonb),public.set_product_archived(uuid,uuid,bigint,boolean),public.set_member_role(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
