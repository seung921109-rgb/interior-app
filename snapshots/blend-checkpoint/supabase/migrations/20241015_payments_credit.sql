-- 토스페이먼츠 500원 1회 충전
create table if not exists public.payments (
  order_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  credits integer not null default 1 check (credits > 0),
  payment_key text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own"
  on public.payments
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');

create or replace function public.credit_paid_order(
  p_order_id text,
  p_payment_key text,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments%rowtype;
  remaining integer;
begin
  select * into pay
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if pay.amount <> p_amount then
    raise exception 'amount mismatch';
  end if;

  if pay.status = 'paid' then
    select free_count into remaining from public.profiles where id = pay.user_id;
    return remaining;
  end if;

  if pay.status <> 'pending' then
    raise exception 'order not payable';
  end if;

  update public.payments
  set
    status = 'paid',
    payment_key = p_payment_key,
    paid_at = now()
  where order_id = p_order_id;

  update public.profiles
  set free_count = free_count + pay.credits
  where id = pay.user_id
  returning free_count into remaining;

  return remaining;
end;
$$;

revoke all on function public.credit_paid_order(text, text, integer) from public;
revoke all on function public.credit_paid_order(text, text, integer) from anon;
revoke all on function public.credit_paid_order(text, text, integer) from authenticated;
grant execute on function public.credit_paid_order(text, text, integer) to service_role;
