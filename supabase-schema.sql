-- Family Calendar Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  family_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  role text not null check (role in ('parent','kid')),
  color text not null default '#5b67f1',
  created_at timestamptz not null default now()
);

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null unique,
  role text not null default 'kid' check (role in ('parent','kid')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  end_time text,
  people uuid[] not null default '{}',
  type text,
  notes text,
  repeat_rule text,
  repeat_days int[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  due_date date not null,
  people uuid[] not null default '{}',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_completions (
  event_id text not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create or replace function public.is_family_parent(p_family_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where user_id=auth.uid() and family_id=p_family_id and role='parent') $$;

create or replace function public.my_family_id()
returns uuid language sql stable security definer set search_path = public
as $$ select family_id from public.profiles where user_id=auth.uid() limit 1 $$;

create or replace function public.create_family(p_family_name text, p_person_name text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare f_id uuid; f_code text; begin
  if exists(select 1 from public.profiles where user_id=auth.uid()) then raise exception 'This account is already in a family.'; end if;
  f_code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  while exists(select 1 from public.families where family_code=f_code) loop f_code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8)); end loop;
  insert into public.families(name,family_code,created_by) values(trim(p_family_name),f_code,auth.uid()) returning id into f_id;
  insert into public.profiles(user_id,family_id,name,role,color) values(auth.uid(),f_id,trim(p_person_name),'parent','#e66a8a');
  return jsonb_build_object('family_id',f_id,'family_code',f_code);
end $$;

grant execute on function public.create_family(text,text) to authenticated;

create or replace function public.join_family(p_code text, p_person_name text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare f public.families; inv public.family_invites; existing public.profiles; begin
  if exists(select 1 from public.profiles where user_id=auth.uid()) then raise exception 'This account is already locked to a family.'; end if;
  select * into f from public.families where upper(family_code)=upper(trim(p_code));
  if not found then
    select * into inv from public.family_invites where upper(code)=upper(trim(p_code)) and used_at is null and expires_at > now();
    if not found then raise exception 'That family or invite code is invalid or expired.'; end if;
    select * into f from public.families where id=inv.family_id;
  else
    inv := null;
  end if;
  insert into public.profiles(user_id,family_id,name,role,color) values(auth.uid(),f.id,trim(p_person_name),coalesce(inv.role,'kid'),'#5b67f1');
  if inv.id is not null then update public.family_invites set used_at=now() where id=inv.id; end if;
  return jsonb_build_object('family_id',f.id,'family_name',f.name);
end $$;

grant execute on function public.join_family(text,text) to authenticated;

create or replace function public.create_family_invite(p_role text default 'kid')
returns text language plpgsql security definer set search_path = public
as $$
declare f_id uuid; c text; begin
  f_id := public.my_family_id();
  if f_id is null or not public.is_family_parent(f_id) then raise exception 'Only parents can create invites.'; end if;
  c := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  while exists(select 1 from public.family_invites where code=c) loop c := upper(substr(encode(gen_random_bytes(6),'hex'),1,8)); end loop;
  insert into public.family_invites(family_id,code,role,created_by) values(f_id,c,case when p_role='parent' then 'parent' else 'kid' end,auth.uid());
  return c;
end $$;

grant execute on function public.create_family_invite(text) to authenticated;

create or replace function public.set_task_completed(p_task_id text, p_completed boolean)
returns void language plpgsql security definer set search_path = public
as $$ begin
  if not exists(select 1 from public.tasks t where t.id=p_task_id and t.family_id=public.my_family_id() and (public.is_family_parent(t.family_id) or auth.uid()=any(t.people))) then raise exception 'You cannot change this task.'; end if;
  update public.tasks set completed=p_completed, updated_at=now() where id=p_task_id;
end $$;

grant execute on function public.set_task_completed(text,boolean) to authenticated;

create or replace function public.set_event_completed(p_event_id text, p_completed boolean)
returns void language plpgsql security definer set search_path = public
as $$ begin
  if not exists(select 1 from public.events e where e.id=p_event_id and e.family_id=public.my_family_id() and (public.is_family_parent(e.family_id) or auth.uid()=any(e.people))) then raise exception 'You cannot change this event.'; end if;
  insert into public.event_completions(event_id,user_id,completed,updated_at) values(p_event_id,auth.uid(),p_completed,now()) on conflict(event_id,user_id) do update set completed=excluded.completed,updated_at=now();
end $$;

grant execute on function public.set_event_completed(text,boolean) to authenticated;

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.family_invites enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.event_completions enable row level security;

revoke all on public.families,public.profiles,public.family_invites,public.events,public.tasks,public.event_completions from anon;
grant select,insert,update,delete on public.families,public.profiles,public.family_invites,public.events,public.tasks,public.event_completions to authenticated;

create policy "family members can view family" on public.families for select to authenticated using (id=public.my_family_id());
create policy "users view own family profiles" on public.profiles for select to authenticated using (family_id=public.my_family_id());
create policy "parents update family profiles" on public.profiles for update to authenticated using (family_id=public.my_family_id() and public.is_family_parent(family_id)) with check (family_id=public.my_family_id());
create policy "parents view invites" on public.family_invites for select to authenticated using (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "parents manage invites" on public.family_invites for delete to authenticated using (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "family view events" on public.events for select to authenticated using (family_id=public.my_family_id() and (public.is_family_parent(family_id) or auth.uid()=any(people)));
create policy "parents insert events" on public.events for insert to authenticated with check (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "parents update events" on public.events for update to authenticated using (family_id=public.my_family_id() and public.is_family_parent(family_id)) with check (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "parents delete events" on public.events for delete to authenticated using (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "family view tasks" on public.tasks for select to authenticated using (family_id=public.my_family_id() and (public.is_family_parent(family_id) or auth.uid()=any(people)));
create policy "parents insert tasks" on public.tasks for insert to authenticated with check (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "parents update tasks" on public.tasks for update to authenticated using (family_id=public.my_family_id() and public.is_family_parent(family_id)) with check (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "parents delete tasks" on public.tasks for delete to authenticated using (family_id=public.my_family_id() and public.is_family_parent(family_id));
create policy "users view own event completions" on public.event_completions for select to authenticated using (user_id=auth.uid());
