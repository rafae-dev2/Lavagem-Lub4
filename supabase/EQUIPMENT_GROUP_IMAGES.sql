-- v10.11: objetos compactos no Storage; somente metadados no PostgreSQL.
begin;
create table if not exists public.equipment_image_editors (
  email text primary key check (email = lower(trim(email)) and position('@' in email)>1),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.equipment_image_editors enable row level security;
revoke all on public.equipment_image_editors from anon,authenticated;
grant all on public.equipment_image_editors to service_role;

create or replace function public.is_equipment_image_editor()
returns boolean language sql stable security definer
set search_path = pg_catalog,public
as $$ select auth.uid() is not null and exists (
  select 1 from public.equipment_image_editors e
  where e.enabled and e.email=lower(coalesce(auth.jwt()->>'email',''))
); $$;
revoke all on function public.is_equipment_image_editor() from public;
grant execute on function public.is_equipment_image_editor() to anon,authenticated,service_role;

create table if not exists public.equipment_group_images (
  group_id text primary key references public.apoio_grupos(id) on delete restrict,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/png','image/webp')),
  bytes integer not null check (bytes between 1 and 180000),
  width integer not null check (width between 1 and 640),
  height integer not null check (height between 1 and 640),
  updated_at timestamptz not null default now(),
  check (object_path ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.(png|webp)$' and split_part(object_path,'/',1)=group_id)
);
alter table public.equipment_group_images enable row level security;
revoke all on public.equipment_group_images from anon,authenticated;
grant select on public.equipment_group_images to anon,authenticated;
grant insert,update,delete on public.equipment_group_images to authenticated;
grant all on public.equipment_group_images to service_role;
create policy equipment_group_images_read on public.equipment_group_images for select to anon,authenticated using (true);
create policy equipment_group_images_insert on public.equipment_group_images for insert to authenticated
with check (public.is_equipment_image_editor() and exists(select 1 from storage.objects o where o.bucket_id='equipment-group-images' and o.name=object_path));
create policy equipment_group_images_update on public.equipment_group_images for update to authenticated
using (public.is_equipment_image_editor())
with check (public.is_equipment_image_editor() and exists(select 1 from storage.objects o where o.bucket_id='equipment-group-images' and o.name=object_path));
create policy equipment_group_images_delete on public.equipment_group_images for delete to authenticated using (public.is_equipment_image_editor());

create or replace function public.touch_equipment_group_image()
returns trigger language plpgsql set search_path=pg_catalog,public
as $$ begin new.updated_at=now();return new;end; $$;
create trigger equipment_group_image_updated before update on public.equipment_group_images for each row execute function public.touch_equipment_group_image();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select 'equipment-group-images','equipment-group-images',true,180000,array['image/png','image/webp'] limit 1
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy equipment_images_object_read on storage.objects for select to anon,authenticated using(bucket_id='equipment-group-images');
create policy equipment_images_object_insert on storage.objects for insert to authenticated with check(
  bucket_id='equipment-group-images' and public.is_equipment_image_editor()
  and name ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.(png|webp)$'
  and exists(select 1 from public.apoio_grupos g where g.id=split_part(name,'/',1))
);
-- Substituições usam nomes novos e não sobrescrevem o arquivo anterior.
create policy equipment_images_object_delete on storage.objects for delete to authenticated using(
  bucket_id='equipment-group-images' and public.is_equipment_image_editor()
  and not exists(select 1 from public.equipment_group_images e where e.object_path=name)
);
commit;
