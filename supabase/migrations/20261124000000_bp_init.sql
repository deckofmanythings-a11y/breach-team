-- Breach Team online saves. Lives in the shared raided-hex project, bp_ prefix.
-- RLS on with NO policies: clients never touch these tables directly. Every read and write goes
-- through the boarding-api Edge Function (service role), which runs the game rules and the
-- deterministic mission engine itself.

create table if not exists bp_players (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 20),
  save          jsonb not null,
  version       int  not null default 0,          -- optimistic lock: every write bumps it
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists bp_players_name_uq on bp_players (lower(display_name));

-- One row per boarding action. Enough to re-simulate it exactly (input + engine_version) and
-- check the result (hash). Feeds the ladder later (Phase 8).
create table if not exists bp_missions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references bp_players(user_id) on delete cascade,
  at             timestamptz not null default now(),
  ship           text not null,
  entry          text not null,
  tactic         text not null,
  retreat        text not null,
  result         text not null,
  squad_size     int  not null,
  kia            int  not null default 0,
  bucs           int  not null default 0,
  seed           bigint not null,
  engine_version int  not null,
  hash           text not null,
  input          jsonb not null
);
create index if not exists bp_missions_user_at on bp_missions (user_id, at desc);
create index if not exists bp_missions_at on bp_missions (at desc);

alter table bp_players  enable row level security;
alter table bp_missions enable row level security;
