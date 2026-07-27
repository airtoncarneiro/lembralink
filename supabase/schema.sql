create extension if not exists vector with schema extensions;

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  original_url text not null,
  normalized_url text not null,
  description text,
  author text,
  language text,
  summary text not null check (char_length(summary) between 1 and 1500),
  category text,
  page_type text,
  tags text[] not null default '{}',
  content_excerpt text,
  content_hash text,
  embedding extensions.vector(768) not null,
  embedding_model text not null default 'gemini-embedding-2',
  embedding_dimensions smallint not null default 768 check (embedding_dimensions = 768),
  embedding_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  indexed_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  constraint bookmarks_user_url_unique unique (user_id, normalized_url)
);

alter table public.bookmarks enable row level security;
create policy "users manage only their bookmarks"
on public.bookmarks for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on table public.bookmarks to authenticated;

create table public.bookmark_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('save', 'search', 'export', 'access', 'delete')),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, action, window_started_at)
);
alter table public.bookmark_rate_limits enable row level security;

create or replace function public.consume_bookmark_rate_limit(requested_action text, max_requests integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare new_count integer;
begin
  if auth.uid() is null or requested_action not in ('save', 'search', 'export', 'access', 'delete') or max_requests < 1 then return false; end if;
  insert into public.bookmark_rate_limits (user_id, action, window_started_at, request_count)
  values (auth.uid(), requested_action, date_trunc('minute', now()), 1)
  on conflict (user_id, action, window_started_at) do update
    set request_count = public.bookmark_rate_limits.request_count + 1
    where public.bookmark_rate_limits.request_count < max_requests
  returning request_count into new_count;
  return new_count is not null;
end;
$$;
revoke all on function public.consume_bookmark_rate_limit(text, integer) from public;
grant execute on function public.consume_bookmark_rate_limit(text, integer) to authenticated;

create or replace function public.match_bookmarks(query_embedding extensions.vector(768), match_count integer default 10)
returns table (
  id uuid, title text, original_url text, summary text, category text, page_type text,
  tags text[], created_at timestamptz, last_accessed_at timestamptz, similarity double precision
)
language sql stable set search_path = public, extensions as $$
  select b.id, b.title, b.original_url, b.summary, b.category, b.page_type, b.tags,
         b.created_at, b.last_accessed_at, 1 - (b.embedding <=> query_embedding) as similarity
  from public.bookmarks b
  where b.user_id = auth.uid()
  order by b.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
revoke all on function public.match_bookmarks(extensions.vector, integer) from public;
grant execute on function public.match_bookmarks(extensions.vector, integer) to authenticated;
