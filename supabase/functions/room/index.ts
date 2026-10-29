// Authoritative room backend. All game logic is imported from src/ so the
// browser demo backend and this one can't drift apart.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  applyCommand, cleanName, createRoom, joinRoom, tick, toView, RoomError,
} from '../../../src/lib/room.ts'
import type { Command, Room } from '../../../src/lib/room.ts'
import { GameError } from '../../../src/games/types.ts'
import type { GameContent } from '../../../src/games/types.ts'
import { MAX_CUSTOM_QUESTIONS, MAX_LINE_LENGTH, MAX_LINES_PER_REQUEST, planAdd } from '../../../src/games/most-likely-to/questionFormat.ts'
import type { AddResult, CustomQuestion } from '../../../src/games/most-likely-to/questionFormat.ts'
import { generateRoomCode } from '../../../src/lib/roomCode.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SERVICE_KEY)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// The token is the player's secret. Only a hash-derived id is stored/shared.
async function playerIdFrom(token: unknown): Promise<string> {
  if (typeof token !== 'string' || token.length < 16 || token.length > 100) {
    throw new RoomError('Invalid session')
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface Loaded { room: Room; version: number; changed: boolean }

async function load(code: string): Promise<Omit<Loaded, 'changed'>> {
  const { data } = await db.from('rooms').select('state, version, expires_at').eq('code', code).maybeSingle()
  if (!data || new Date(data.expires_at) < new Date()) throw new RoomError('Room not found or expired')
  return { room: data.state as Room, version: data.version }
}

// Tells connected clients to refetch. The payload is only a version number, so
// nothing private goes over the (public) channel. Runs after the response is
// sent so it never adds latency to the request.
function announce(code: string, version: number) {
  const p = fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ messages: [{ topic: `room:${code}`, event: 'changed', payload: { v: version }, private: false }] }),
  }).catch((e) => console.error('broadcast failed', e))
  ;(globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(p)
}

// Optimistic concurrency: retry if another request changed the room first.
async function mutate(code: string, fn: (room: Room, now: number) => Room): Promise<Loaded> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { room, version } = await load(code)
    const next = fn(room, Date.now())
    if (next === room) return { room, version, changed: false }
    const { data } = await db
      .from('rooms')
      .update({ state: next, version: version + 1 })
      .eq('code', code)
      .eq('version', version)
      .select('code')
    if (data && data.length > 0) {
      announce(code, version + 1)
      return { room: next, version: version + 1, changed: true }
    }
  }
  throw new RoomError('The room is busy, please try again')
}

const GAME_ID = 'most-likely-to'

// Questions for a game: the built-in library plus this room's own.
async function loadContent(code: string): Promise<GameContent> {
  const { data, error } = await db
    .from('questions')
    .select('text, room_code')
    .eq('game_id', GAME_ID)
    .eq('status', 'active')
    .or(`room_code.is.null,room_code.eq.${code}`) // code is validated as [A-Z0-9]{5}
  if (error) throw error
  return { questions: (data ?? []).map((q) => ({ text: q.text, source: q.room_code ? 'custom' as const : 'builtin' as const })) }
}

async function listCustom(code: string): Promise<CustomQuestion[]> {
  const { data, error } = await db
    .from('questions')
    .select('id, text')
    .eq('game_id', GAME_ID)
    .eq('room_code', code)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function requireHost(code: string, me: string, lobbyOnly: boolean) {
  const { room } = await load(code)
  if (room.hostId !== me) throw new RoomError('Only the host can do that')
  if (lobbyOnly && room.status !== 'lobby') throw new RoomError('Questions can only be changed in the lobby')
}

async function addQuestions(code: string, lines: unknown): Promise<AddResult> {
  if (!Array.isArray(lines) || lines.length > 200 || lines.some((l) => typeof l !== 'string' || l.length > MAX_LINE_LENGTH)) {
    throw new RoomError('That doesn’t look like a list of questions')
  }
  const { data, error } = await db
    .from('questions')
    .select('text, room_code')
    .eq('game_id', GAME_ID)
    .or(`room_code.is.null,room_code.eq.${code}`)
  if (error) throw error
  const existing = (data ?? []).filter((q) => q.room_code).map((q) => q.text as string)
  const builtin = (data ?? []).filter((q) => !q.room_code).map((q) => q.text as string)
  const plan = planAdd(lines as string[], existing, builtin, MAX_CUSTOM_QUESTIONS)
  if (plan.accepted.length > 0) {
    const { error: insertError } = await db
      .from('questions')
      .insert(plan.accepted.map((text) => ({ game_id: GAME_ID, room_code: code, category: 'Custom', text })))
    if (insertError) {
      if (insertError.code === '23505') throw new RoomError('Some of those were just added. Please try again.')
      throw insertError
    }
  }
  return { added: plan.accepted.length, skipped: plan.skipped, questions: await listCustom(code) }
}

const view = (l: { room: Room; version: number }, me: string) => ({ ...toView(l.room, me), version: l.version })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()
    const me = await playerIdFrom(body.token)

    if (body.type === 'create') {
      for (let i = 0; i < 5; i++) {
        const room = createRoom(generateRoomCode(5, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32), me, body.name, 'most-likely-to')
        const { error } = await db.from('rooms').insert({ code: room.code, state: room })
        if (!error) return json({ code: room.code, room: view({ room, version: 0 }, me) })
      }
      throw new RoomError('Could not create a room, please try again')
    }

    const code = String(body.code ?? '').toUpperCase()
    if (!/^[A-Z0-9]{5}$/.test(code)) throw new RoomError('Invalid room code')

    if (body.type === 'get') {
      // Time-based transitions are applied with the server clock.
      return json({ room: view(await mutate(code, (r, now) => tick(r, now)), me) })
    }
    if (body.type === 'join') {
      cleanName(body.name)
      return json({ room: view(await mutate(code, (r) => joinRoom(r, me, body.name)), me) })
    }
    if (body.type === 'command') {
      const cmd = body.command as Command
      // Only starting a game needs the question pool, so only then do we read it.
      const content = cmd?.type === 'start' ? await loadContent(code) : undefined
      return json({ room: view(await mutate(code, (r, now) => applyCommand(tick(r, now), me, cmd, now, content)), me) })
    }

    if (body.type === 'questions.list') {
      await requireHost(code, me, false)
      return json({ questions: await listCustom(code) })
    }
    if (body.type === 'questions.add') {
      await requireHost(code, me, true)
      return json(await addQuestions(code, body.lines))
    }
    if (body.type === 'questions.remove') {
      await requireHost(code, me, true)
      if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id)) throw new RoomError('Unknown question')
      const { error } = await db.from('questions').delete().eq('id', body.id).eq('room_code', code)
      if (error) throw error
      return json({ questions: await listCustom(code) })
    }
    throw new RoomError('Unknown request')
  } catch (e) {
    if (e instanceof RoomError || e instanceof GameError) return json({ error: e.message }, 400)
    console.error(e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
