-- Simultaneous: salas, membros, fila e tokens do Spotify.
-- Acesso do cliente é sempre via usuário (anônimo ou não) autenticado + RLS.

create table public.rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  allow_guest_queue boolean not null default false,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('spotify', 'deezer')),
  display_name text not null default 'Convidado' check (char_length(display_name) <= 40),
  joined_at timestamptz not null default now(),
  primary key (room_code, user_id)
);

create table public.queue_items (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,
  position integer not null,
  isrc text not null,
  spotify_id text,
  deezer_id text,
  title text not null,
  artist text not null,
  duration_ms integer not null check (duration_ms > 0),
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index queue_items_room_pos on public.queue_items (room_code, position);

-- Tokens do Spotify: somente servidor (secret key). Sem policies = sem acesso do cliente.
create table public.spotify_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.queue_items enable row level security;
alter table public.spotify_tokens enable row level security;

-- Helpers (security definer evita recursão de RLS)
create function public.is_room_member(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_members where room_code = p_code and user_id = auth.uid());
$$;

create function public.is_room_host(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from rooms where code = p_code and host_id = auth.uid());
$$;

-- rooms
create policy rooms_select on public.rooms for select to authenticated
  using (host_id = auth.uid() or public.is_room_member(code));
create policy rooms_update_host on public.rooms for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy rooms_delete_host on public.rooms for delete to authenticated
  using (host_id = auth.uid());
-- inserção apenas via create_room()

-- room_members
create policy members_select on public.room_members for select to authenticated
  using (public.is_room_member(room_code));
create policy members_delete_self_or_host on public.room_members for delete to authenticated
  using (user_id = auth.uid() or public.is_room_host(room_code));
-- inserção apenas via create_room()/join_room()

-- queue_items
create policy queue_select on public.queue_items for select to authenticated
  using (public.is_room_member(room_code));
create policy queue_insert on public.queue_items for insert to authenticated
  with check (
    added_by = auth.uid()
    and public.is_room_member(room_code)
    and (public.is_room_host(room_code)
         or exists (select 1 from rooms r where r.code = room_code and r.allow_guest_queue))
  );
create policy queue_update_host on public.queue_items for update to authenticated
  using (public.is_room_host(room_code)) with check (public.is_room_host(room_code));
create policy queue_delete on public.queue_items for delete to authenticated
  using (public.is_room_host(room_code) or added_by = auth.uid());

-- RPCs
create function public.create_room(p_provider text, p_display_name text default 'Host')
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into rooms (code, host_id) values (v_code, auth.uid());
      exit;
    exception when unique_violation then
      -- tenta outro código
    end;
  end loop;
  insert into room_members (room_code, user_id, provider, display_name)
    values (v_code, auth.uid(), p_provider, left(p_display_name, 40));
  return v_code;
end $$;

create function public.join_room(p_code text, p_provider text, p_display_name text default 'Convidado')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from rooms where code = upper(p_code)) then
    raise exception 'room not found';
  end if;
  insert into room_members (room_code, user_id, provider, display_name)
    values (upper(p_code), auth.uid(), p_provider, left(p_display_name, 40))
  on conflict (room_code, user_id) do update
    set provider = excluded.provider, display_name = excluded.display_name;
end $$;

revoke all on function public.create_room(text, text), public.join_room(text, text, text) from public, anon;
grant execute on function public.create_room(text, text), public.join_room(text, text, text) to authenticated;
grant execute on function public.is_room_member(text), public.is_room_host(text) to authenticated;

-- Realtime privado: canal "room:CODE" só para membros.
create policy realtime_room_read on realtime.messages for select to authenticated
  using (public.is_room_member(split_part(realtime.topic(), ':', 2)));
create policy realtime_room_write on realtime.messages for insert to authenticated
  with check (public.is_room_member(split_part(realtime.topic(), ':', 2)));
