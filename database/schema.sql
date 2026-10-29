-- Run this SQL in your Supabase SQL Editor before enabling request submissions.
create table if not exists public.service_requests (
  id bigint generated always as identity primary key,
  reference text not null unique,
  name text not null,
  phone text not null,
  email text,
  service text not null,
  preferred_date date not null,
  preferred_time text not null default 'Any available time',
  location text not null,
  notes text,
  status text not null default 'new' check (status in ('new','contacted','scheduled','completed','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.service_requests enable row level security;
-- Do not create public SELECT/INSERT policies. Only the server-side service role accesses this table.
