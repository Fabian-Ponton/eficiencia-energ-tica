-- PONTIA · sincronización en la nube (Supabase)
-- Pega todo este archivo en el editor SQL de tu proyecto de Supabase (SQL Editor → New query) y ejecútalo una vez.
-- Se puede volver a ejecutar sin perder datos.

-- 1. Registros de los proyectos: una fila por registro de la app (proyecto, espacio, equipo, factura, tarea…)
create sequence if not exists public.pontia_records_seq;

create table if not exists public.pontia_records (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text not null,
  id text not null,
  project_id text not null,
  data jsonb not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_seq bigint not null default nextval('public.pontia_records_seq'),
  server_at timestamptz not null default now(),
  primary key (owner, table_name, id)
);

create index if not exists pontia_records_owner_seq on public.pontia_records (owner, server_seq);

-- Gana el cambio más reciente: una versión igual o más vieja no reemplaza a la guardada.
-- Cada cambio aceptado recibe un número de secuencia nuevo, que los demás equipos usan para bajarlo.
create or replace function public.pontia_records_touch() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return old;
  end if;
  new.server_seq := nextval('public.pontia_records_seq');
  new.server_at := now();
  return new;
end;
$$;

drop trigger if exists pontia_records_touch on public.pontia_records;
create trigger pontia_records_touch
  before insert or update on public.pontia_records
  for each row execute function public.pontia_records_touch();

-- 2. Seguridad por fila: cada usuario ve y cambia solo sus registros. La app nunca borra: marca deleted_at.
alter table public.pontia_records enable row level security;

drop policy if exists "pontia: ver lo propio" on public.pontia_records;
create policy "pontia: ver lo propio" on public.pontia_records
  for select to authenticated using (owner = auth.uid());

drop policy if exists "pontia: crear lo propio" on public.pontia_records;
create policy "pontia: crear lo propio" on public.pontia_records
  for insert to authenticated with check (owner = auth.uid());

drop policy if exists "pontia: cambiar lo propio" on public.pontia_records;
create policy "pontia: cambiar lo propio" on public.pontia_records
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- 3. Fotos: depósito privado; cada usuario guarda en su carpeta (la primera parte de la ruta es su id)
insert into storage.buckets (id, name, public)
values ('pontia-fotos', 'pontia-fotos', false)
on conflict (id) do nothing;

drop policy if exists "pontia fotos: ver las propias" on storage.objects;
create policy "pontia fotos: ver las propias" on storage.objects
  for select to authenticated
  using (bucket_id = 'pontia-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pontia fotos: subir las propias" on storage.objects;
create policy "pontia fotos: subir las propias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pontia-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pontia fotos: reemplazar las propias" on storage.objects;
create policy "pontia fotos: reemplazar las propias" on storage.objects
  for update to authenticated
  using (bucket_id = 'pontia-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
