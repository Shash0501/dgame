-- Questions live in their own table so they can be edited without a deploy.
-- Built-in questions have room_code = null. Host-added questions belong to one
-- room and are deleted with it. Like `rooms`, RLS is on with no policies: only
-- the Edge Function (service role) can read or write.
create table public.questions (
  id         uuid        primary key default gen_random_uuid(),
  game_id    text        not null default 'most-likely-to',
  room_code  text        references public.rooms (code) on delete cascade,
  category   text        not null default 'Custom',
  text       text        not null check (char_length(text) between 5 and 100),
  status     text        not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

-- No duplicate question within the built-in set, or within one room.
create unique index questions_unique_text
  on public.questions (game_id, coalesce(room_code, ''), lower(text));
create index questions_room_idx on public.questions (room_code);

insert into public.questions (category, text) values
  ('Funny', 'get lost in their own neighbourhood'),
  ('Funny', 'laugh at their own joke before the punchline'),
  ('Funny', 'trip over nothing in public'),
  ('Funny', 'accidentally text the wrong person'),
  ('Funny', 'fall asleep during a movie they picked'),
  ('Funny', 'cry at a TV commercial'),
  ('Funny', 'wave back at someone who wasn’t waving at them'),
  ('Funny', 'get stuck in a revolving door'),
  ('Flirty', 'slide into someone’s DMs first'),
  ('Flirty', 'win a staring contest with a stranger'),
  ('Flirty', 'get a stranger’s number at a coffee shop'),
  ('Flirty', 'come up with the best pickup line'),
  ('Flirty', 'be the last to leave a date'),
  ('Flirty', 'flirt their way out of a parking ticket'),
  ('Flirty', 'fall in love at first sight'),
  ('Flirty', 'send a risky text and instantly regret it'),
  ('Secrets', 'keep a secret for ten years'),
  ('Secrets', 'have a hidden talent nobody knows about'),
  ('Secrets', 'secretly binge a show everyone hates'),
  ('Secrets', 'have a secret social media account'),
  ('Secrets', 'know the group’s biggest secret'),
  ('Secrets', 'hide an embarrassing childhood nickname'),
  ('Secrets', 'pretend to be busy to skip plans'),
  ('Secrets', 'have a guilty pleasure song'),
  ('Friendship', 'show up with snacks when you’re sad'),
  ('Friendship', 'still be your friend in 50 years'),
  ('Friendship', 'remember everyone’s birthday'),
  ('Friendship', 'plan the group trip'),
  ('Friendship', 'give the best advice'),
  ('Friendship', 'lend you money without asking why'),
  ('Friendship', 'start a group chat for no reason'),
  ('Friendship', 'drive across town to help a friend'),
  ('Savage', 'leave the group chat without saying goodbye'),
  ('Savage', 'be late to their own birthday'),
  ('Savage', 'ghost a friend for a month'),
  ('Savage', 'spoil the ending of a movie'),
  ('Savage', 'eat the last slice without asking'),
  ('Savage', 'reply with just “k” to a long message'),
  ('Savage', 'steal food off your plate'),
  ('Savage', 'cancel plans at the last minute'),
  ('Relationships', 'get married first'),
  ('Relationships', 'text their ex at 2am'),
  ('Relationships', 'stay friends with all their exes'),
  ('Relationships', 'propose in a really public way'),
  ('Relationships', 'cry at a wedding'),
  ('Relationships', 'have a whirlwind romance'),
  ('Relationships', 'forget an anniversary'),
  ('Relationships', 'go on a blind date just for fun'),
  ('Hypothetical situations', 'survive a zombie apocalypse'),
  ('Hypothetical situations', 'become famous overnight'),
  ('Hypothetical situations', 'win the lottery and lose the ticket'),
  ('Hypothetical situations', 'love being stranded on a deserted island'),
  ('Hypothetical situations', 'become a billionaire and stay humble'),
  ('Hypothetical situations', 'accidentally join a cult'),
  ('Hypothetical situations', 'win a reality TV show'),
  ('Hypothetical situations', 'panic when stuck in an elevator');

