-- Kakao(Supabase Auth) 사용자 프로필 + 무료 사용 횟수
-- Dashboard > SQL Editor에서 실행하거나 `supabase db push`로 적용합니다.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  provider text,
  free_count integer not null default 3 check (free_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '로그인 사용자 프로필. free_count는 무료 시뮬레이션/저장 횟수입니다.';
comment on column public.profiles.free_count is '남은 무료 사용 횟수. 가입 시 기본값 3.';

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    provider,
    free_count
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'nickname'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    coalesce(new.raw_app_meta_data ->> 'provider', 'kakao'),
    3
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.consume_free_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  if auth.uid() is null then
    return -1;
  end if;

  update public.profiles
  set free_count = free_count - 1
  where id = auth.uid()
    and free_count > 0
  returning free_count into remaining;

  if remaining is null then
    return -1;
  end if;

  return remaining;
end;
$$;

revoke all on function public.consume_free_count() from public;
grant execute on function public.consume_free_count() to authenticated;

insert into public.profiles (id, email, display_name, provider, free_count)
select
  id,
  email,
  coalesce(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    raw_user_meta_data ->> 'nickname'
  ),
  coalesce(raw_app_meta_data ->> 'provider', 'kakao'),
  3
from auth.users
on conflict (id) do nothing;
