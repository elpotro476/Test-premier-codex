-- LOCAL TEST DATABASE ONLY. Simulates the Supabase auth.uid() contract, not Auth itself.
do $$begin
 if current_database() <> 'semin_v3_test' then raise exception 'Test database required'; end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
