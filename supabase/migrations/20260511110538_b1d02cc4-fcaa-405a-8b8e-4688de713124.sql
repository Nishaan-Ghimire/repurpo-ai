
-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Voice profiles
create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_name text not null,
  voice_description text,
  tone text,
  writing_style text,
  example_content text,
  analysis jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.voice_profiles enable row level security;
create policy "Users manage own voice_profiles" on public.voice_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Content uploads
create table public.content_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_content text,
  transcript text,
  content_type text not null default 'text',
  file_path text,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);
alter table public.content_uploads enable row level security;
create policy "Users manage own content_uploads" on public.content_uploads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Generated assets
create table public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.content_uploads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  generated_text text not null,
  voice_profile_id uuid references public.voice_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.generated_assets enable row level security;
create policy "Users manage own generated_assets" on public.generated_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Generation logs
create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_tokens int default 0,
  response_tokens int default 0,
  generation_type text not null,
  created_at timestamptz not null default now()
);
alter table public.generation_logs enable row level security;
create policy "Users view own generation_logs" on public.generation_logs for select using (auth.uid() = user_id);
create policy "Users insert own generation_logs" on public.generation_logs for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for content uploads
insert into storage.buckets (id, name, public) values ('content-uploads', 'content-uploads', false)
on conflict (id) do nothing;

create policy "Users upload own files" on storage.objects for insert
  with check (bucket_id = 'content-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users read own files" on storage.objects for select
  using (bucket_id = 'content-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own files" on storage.objects for delete
  using (bucket_id = 'content-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
