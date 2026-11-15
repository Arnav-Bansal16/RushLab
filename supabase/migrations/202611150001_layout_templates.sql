-- Private, versioned organizer layouts. Apply in the chosen Supabase project.
create table if not exists public.layout_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  format_version integer not null default 1 check (format_version = 1),
  document jsonb not null check ((
    jsonb_typeof(document) = 'object'
    and document ->> 'schemaVersion' = '1'
    and jsonb_typeof(document -> 'editor') = 'object'
    and octet_length(document::text) <= 1000000
  ) is true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists layout_templates_owner_updated_idx on public.layout_templates(owner_id, updated_at desc);
alter table public.layout_templates enable row level security;
alter table public.layout_templates force row level security;
revoke all on public.layout_templates from anon;
revoke all on public.layout_templates from authenticated;
grant select, insert, update on public.layout_templates to authenticated;

create policy "Organizers read their own templates" on public.layout_templates for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Organizers create their own templates" on public.layout_templates for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Organizers update their own templates" on public.layout_templates for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
-- No delete or sharing policy. Templates are private; user deletion cascades.
create or replace function public.set_layout_template_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger layout_templates_updated before update on public.layout_templates
for each row execute function public.set_layout_template_updated_at();
