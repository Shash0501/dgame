# Deploying dgame

The app is a static React site (hosted on Vercel) plus a Supabase backend
(database + one Edge Function). Both fit comfortably in the free tiers.

```
Players' phones ──► Vercel (static site) ──► Supabase Edge Function ──► Postgres
                                        └──► Supabase Realtime (change pings)
```

You need, all free:
- A [GitHub](https://github.com) account (the repo is already here).
- A [Supabase](https://supabase.com) account.
- A [Vercel](https://vercel.com) account.
- The Supabase CLI: `brew install supabase/tap/supabase`.

---

## 1. Set up the Supabase backend

### 1.1 Create the project
1. In the Supabase dashboard, **New project**. Pick a region close to your
   players — it's the biggest factor in how snappy the game feels.
2. Wait for it to finish provisioning.

### 1.2 Get the two values the frontend needs
In **Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL` (e.g. `https://abcd.supabase.co`).
- **Publishable / anon key** → `VITE_SUPABASE_ANON_KEY`.

Both are safe to expose in the browser. Never put the **service_role** /
**secret** key in the frontend or in Vercel — the Edge Function gets its own
copy automatically.

### 1.3 Push the database schema and the function
From the project root:
```
supabase login                       # opens a browser; or: supabase login --token <token>
supabase link --project-ref <your-project-ref>
supabase db push                     # creates the rooms + questions tables, seeds questions
supabase functions deploy room --no-verify-jwt
```
`--no-verify-jwt` is required: players have no Supabase accounts. The function
does its own auth — each device holds a secret token and the server trusts only
a hash of it, and it validates every host action independently.

> `--use-api` can be added to the deploy if you don't have Docker running.

### 1.4 Schedule room cleanup (recommended)
Expired rooms (6h after creation) are only removed when this runs. In the
Supabase **SQL Editor**:
```sql
create extension if not exists pg_cron;
select cron.schedule(
  'cleanup-rooms', '*/15 * * * *',
  $$ select public.cleanup_expired_rooms() $$
);
```

---

## 2. Deploy the frontend to Vercel

### Option A — dashboard (simplest)
1. Push this repo to GitHub (see §3) if you haven't.
2. In Vercel, **Add New → Project**, and import the repo.
3. Vercel detects Vite from `vercel.json` (build `npm run build`, output `dist`).
   Leave these as-is.
4. Under **Environment Variables**, add both, for all environments:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Deploy**. You get a `https://<project>.vercel.app` URL.

> These are build-time variables (Vite inlines `VITE_*` at build). After
> changing them in Vercel, trigger a redeploy so the new values take effect.

### Option B — CLI
```
npm i -g vercel
vercel                      # link/create the project (first run)
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod               # production deploy
```

---

## 3. Push the repo to GitHub
```
# create an empty repo on GitHub first, then:
git remote add origin https://github.com/<you>/dgame.git   # if not already set
git push -u origin main
```
`.env` and `supabase/.temp/` are gitignored, so no secrets are pushed.

---

## 4. Verify the deployment
1. Open the Vercel URL on your phone → enter a name → **Create a room**.
2. Open the same URL on 3+ other devices/tabs, join with the code.
3. The lobby should update in near real time as players join.
4. Start a game; confirm everyone sees the same question and voting/reveal work.

If rooms don't sync across devices, the env vars almost certainly aren't set on
Vercel (the app silently falls back to the browser-only backend). Open the
browser console: a working deploy talks to `…/functions/v1/room`.

---

## 5. Custom domain (optional)
Vercel → project → **Settings → Domains**. The free `*.vercel.app` subdomain is
served over HTTPS and is enough to play.

---

## Free-tier notes
- **Supabase** free projects pause after ~1 week of inactivity; the first
  request afterwards wakes it (a few seconds). Edge Functions also cold-start
  (~1–2s) after being idle — the first action in a fresh room is the slowest.
- **Realtime / function calls** scale with players and rounds, not with idle
  time: idle rooms make no calls. A 14-player session is tiny against the free
  quotas.
- Watch usage in each dashboard and read the current free-tier limits before a
  big event; provider limits change.

## Updating after a code change
- **Frontend:** push to GitHub; Vercel auto-deploys the branch.
- **Backend logic** (anything under `src/` that the function imports, or
  `supabase/functions/`): re-run `supabase functions deploy room --no-verify-jwt`.
- **Schema** (`supabase/migrations/`): add a new migration file and
  `supabase db push`.
