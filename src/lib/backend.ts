import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Command, Room, RoomView } from './room.ts'
import { applyCommand, createRoom, joinRoom, tick, toView } from './room.ts'
import { generateRoomCode } from './roomCode.ts'
import { builtinContent, questions as builtinQuestions } from '../games/most-likely-to/questions.ts'
import { MAX_CUSTOM_QUESTIONS, planAdd } from '../games/most-likely-to/questionFormat.ts'
import type { AddResult, CustomQuestion } from '../games/most-likely-to/questionFormat.ts'

// Every screen talks to a Backend and only ever sees a RoomView, so the same UI
// runs against the local (browser-only) demo backend or the Supabase one.
export interface Backend {
  createRoom(name: string): Promise<string>
  joinRoom(code: string, name: string): Promise<void>
  // Resolves with the fresh view, which is also pushed to subscribers.
  send(code: string, command: Command): Promise<RoomView>
  // Host-only: the room's own questions.
  listQuestions(code: string): Promise<CustomQuestion[]>
  addQuestions(code: string, lines: string[]): Promise<AddResult>
  removeQuestion(code: string, id: string): Promise<CustomQuestion[]>
  // Forces a fetch (e.g. when a round deadline passes).
  refresh(code: string): Promise<void>
  // Calls onChange with each fresh view, or null once the room is gone.
  subscribe(code: string, onChange: (view: RoomView | null) => void): () => void
}

// Server clock minus device clock, so countdowns can't be skewed by a wrong
// device clock.
let clockOffset = 0
export const serverNow = () => Date.now() + clockOffset

// Secret identity for this tab. The Supabase backend derives the public player
// id from it, so other players never learn it.
export function getToken(): string {
  let t = sessionStorage.getItem('dgame:token')
  if (!t) {
    t = crypto.randomUUID() + crypto.randomUUID()
    sessionStorage.setItem('dgame:token', t)
  }
  return t
}

const KEY = (code: string) => `dgame:room:${code}`

function createLocalBackend(): Backend {
  const me = getToken()
  const channel = new BroadcastChannel('dgame')
  const listeners = new Map<string, Set<() => void>>()
  const notify = (code: string) => listeners.get(code)?.forEach((fn) => fn())
  channel.onmessage = (e) => notify(e.data)

  const read = (code: string): Room => {
    const raw = localStorage.getItem(KEY(code))
    if (!raw) throw new Error('Room not found or expired')
    return JSON.parse(raw) as Room
  }
  const write = (room: Room) => {
    localStorage.setItem(KEY(room.code), JSON.stringify(room))
    channel.postMessage(room.code)
    notify(room.code)
  }
  const mutate = (code: string, fn: (r: Room, now: number) => Room): Room => {
    const room = read(code)
    const next = fn(room, Date.now())
    if (next !== room) write(next)
    return next
  }

  // Demo mode keeps each room's questions next to the room in localStorage.
  const QKEY = (code: string) => `dgame:questions:${code}`
  const readQ = (code: string): CustomQuestion[] => JSON.parse(localStorage.getItem(QKEY(code)) ?? '[]')
  const hostOnly = (code: string) => {
    if (read(code).hostId !== me) throw new Error('Only the host can do that')
  }

  return {
    async listQuestions(code) {
      hostOnly(code)
      return readQ(code)
    },
    async addQuestions(code, lines) {
      hostOnly(code)
      const existing = readQ(code)
      const plan = planAdd(lines, existing.map((q) => q.text), builtinQuestions.map((q) => q.text), MAX_CUSTOM_QUESTIONS)
      const next = [...existing, ...plan.accepted.map((text) => ({ id: crypto.randomUUID(), text }))]
      localStorage.setItem(QKEY(code), JSON.stringify(next))
      return { added: plan.accepted.length, skipped: plan.skipped, questions: next }
    },
    async removeQuestion(code, id) {
      hostOnly(code)
      const next = readQ(code).filter((q) => q.id !== id)
      localStorage.setItem(QKEY(code), JSON.stringify(next))
      return next
    },
    async createRoom(name) {
      let code = generateRoomCode()
      while (localStorage.getItem(KEY(code))) code = generateRoomCode()
      write(createRoom(code, me, name, 'most-likely-to'))
      return code
    },
    async joinRoom(code, name) {
      mutate(code, (r) => joinRoom(r, me, name))
    },
    async send(code, command) {
      const content = {
        questions: [...builtinContent.questions, ...readQ(code).map((q) => ({ text: q.text, source: 'custom' as const }))],
      }
      return toView(mutate(code, (r, now) => applyCommand(tick(r, now), me, command, now, content)), me)
    },
    async refresh(code) {
      mutate(code, (r, now) => tick(r, now))
    },
    subscribe(code, onChange) {
      const refresh = () => {
        try {
          onChange(toView(mutate(code, (r, now) => tick(r, now)), me))
        } catch {
          onChange(null)
        }
      }
      if (!listeners.has(code)) listeners.set(code, new Set())
      listeners.get(code)!.add(refresh)
      const timer = setInterval(refresh, 500)
      refresh()
      return () => {
        listeners.get(code)?.delete(refresh)
        clearInterval(timer)
      }
    },
  }
}

function createSupabaseBackend(url: string, anonKey: string): Backend {
  const token = getToken()
  // Used only for Realtime pings; all data goes through the Edge Function.
  const rt = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

  const cache = new Map<string, RoomView>()
  const subs = new Map<string, Set<(v: RoomView | null) => void>>()
  const pending = new Map<string, Promise<void>>()
  const channels = new Map<string, { ch: RealtimeChannel; count: number; closeTimer?: ReturnType<typeof setTimeout> }>()

  async function call<T>(body: Record<string, unknown>): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${url}/functions/v1/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ ...body, token }),
      })
    } catch {
      throw new Error('Can’t reach the game server. Check your connection and try again.')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
    return data as T
  }

  // Accepts a fresh view unless it is older than what we already have.
  function accept(code: string, v: RoomView) {
    const cur = cache.get(code)
    if (cur?.version !== undefined && v.version !== undefined && v.version < cur.version) return
    clockOffset = v.serverNow - Date.now()
    cache.set(code, v)
    subs.get(code)?.forEach((fn) => fn(v))
  }

  async function fetchView(code: string) {
    try {
      accept(code, (await call<{ room: RoomView }>({ type: 'get', code })).room)
    } catch (e) {
      if (/not found|expired/i.test((e as Error).message)) {
        cache.delete(code)
        subs.get(code)?.forEach((fn) => fn(null))
      }
    }
  }

  // De-duplicates concurrent fetches for the same room.
  function refresh(code: string): Promise<void> {
    let p = pending.get(code)
    if (!p) {
      p = fetchView(code).finally(() => pending.delete(code))
      pending.set(code, p)
    }
    return p
  }

  function openChannel(code: string) {
    let entry = channels.get(code)
    if (entry) {
      clearTimeout(entry.closeTimer)
      entry.count++
      return
    }
    const ch = rt
      .channel(`room:${code}`)
      .on('broadcast', { event: 'changed' }, (msg) => {
        const v = (msg.payload as { v?: number } | undefined)?.v
        const have = cache.get(code)?.version
        // Skip pings for changes we already have (e.g. our own commands).
        if (v !== undefined && have !== undefined && v <= have) return
        void refresh(code).then(() => {
          // A fetch that started before the ping may predate the change.
          const now = cache.get(code)?.version
          if (v !== undefined && (now === undefined || now < v)) void refresh(code)
        })
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refresh(code) // catch anything missed while connecting
      })
    entry = { ch, count: 1 }
    channels.set(code, entry)
  }

  function closeChannel(code: string) {
    const entry = channels.get(code)
    if (!entry || --entry.count > 0) return
    // Delayed so a quick unsubscribe/resubscribe (React StrictMode) reuses it.
    entry.closeTimer = setTimeout(() => {
      if (entry.count === 0) {
        void rt.removeChannel(entry.ch)
        channels.delete(code)
      }
    }, 1000)
  }

  return {
    async createRoom(name) {
      const r = await call<{ code: string; room: RoomView }>({ type: 'create', name })
      accept(r.code, r.room)
      return r.code
    },
    async joinRoom(code, name) {
      accept(code, (await call<{ room: RoomView }>({ type: 'join', code, name })).room)
    },
    async send(code, command) {
      const { room } = await call<{ room: RoomView }>({ type: 'command', code, command })
      accept(code, room)
      return room
    },
    async listQuestions(code) {
      return (await call<{ questions: CustomQuestion[] }>({ type: 'questions.list', code })).questions
    },
    addQuestions(code, lines) {
      return call<AddResult>({ type: 'questions.add', code, lines })
    },
    async removeQuestion(code, id) {
      return (await call<{ questions: CustomQuestion[] }>({ type: 'questions.remove', code, id })).questions
    },
    refresh,
    subscribe(code, onChange) {
      if (!subs.has(code)) subs.set(code, new Set())
      subs.get(code)!.add(onChange)
      const cached = cache.get(code)
      if (cached) onChange(cached)
      void refresh(code)
      openChannel(code)
      // Safety net for a dropped connection: a slow poll, only while visible.
      const timer = setInterval(() => !document.hidden && void refresh(code), 20_000)
      const onVisible = () => !document.hidden && void refresh(code)
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        subs.get(code)?.delete(onChange)
        clearInterval(timer)
        document.removeEventListener('visibilitychange', onVisible)
        closeChannel(code)
      }
    },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isRemote = Boolean(url && key && !url.startsWith('your-'))
export const backend: Backend = isRemote ? createSupabaseBackend(url!, key!) : createLocalBackend()
