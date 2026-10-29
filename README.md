# dgame
Game for large groups. React + TypeScript + Vite + Tailwind, with Supabase as the optional backend.

## Run locally (no backend)
```
npm install
npm run dev
```
Without Supabase env vars the app uses a browser-only backend: rooms sync between tabs of the same browser, not between devices.

## Run with Supabase (real multiplayer)
1. Create a free Supabase project.
2. Link it and push the schema: `supabase link --project-ref <ref>` then `supabase db push`.
3. Deploy the backend: `supabase functions deploy room --no-verify-jwt`
   (the function uses the platform anon key only as a transport header; players are authenticated by their per-tab secret token).
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Schedule `select public.cleanup_expired_rooms()` (e.g. pg_cron every 15 min) to delete expired rooms.

## Architecture
- `src/games/` game modules implementing `GameModule` (`types.ts`), registered in `registry.ts`.
- `src/lib/room.ts` pure, authoritative room rules. Shared by the browser demo backend and the Edge Function.
- `supabase/functions/room` the trusted backend. Clients only receive a per-player `RoomView`, so private votes never leave the server.
- `src/lib/backend.ts` `Backend` interface with local and Supabase implementations.

## Tests
`npm test` (Node's built-in runner, logic only).
