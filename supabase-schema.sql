-- ═══════════════════════════════════════════════════════
-- Upswell Customer Collection — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════

-- 1. Create the customers table
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  memo       text,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.customers enable row level security;

-- 3. Allow anonymous users to INSERT (customer registration)
create policy "anon_insert" on public.customers
  for insert
  to anon
  with check (true);

-- 4. Allow anonymous users to SELECT (admin dashboard)
create policy "anon_select" on public.customers
  for select
  to anon
  using (true);

-- 5. Allow anonymous users to DELETE (admin delete)
create policy "anon_delete" on public.customers
  for delete
  to anon
  using (true);

-- 6. Index for faster ordering
create index if not exists idx_customers_created_at
  on public.customers (created_at desc);
