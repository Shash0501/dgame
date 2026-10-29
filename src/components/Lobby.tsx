import { useState } from 'react'
import type { RoomView } from '../lib/room.ts'
import { getGame } from '../games/registry.ts'
import type { MltSettings } from '../games/most-likely-to/logic.ts'
import { useCommand } from './useCommand.ts'
import { Avatar, Button, Card, ErrorText } from './ui.tsx'
import QuestionsPanel from './QuestionsPanel.tsx'

function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <button aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="h-11 w-11 rounded-xl border border-white/20 text-xl disabled:opacity-30">−</button>
        <output className="w-10 text-center text-lg font-semibold">{value}</output>
        <button aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="h-11 w-11 rounded-xl border border-white/20 text-xl disabled:opacity-30">+</button>
      </span>
    </div>
  )
}

export default function Lobby({ room }: { room: RoomView }) {
  const { send, error } = useCommand(room.code)
  const [copied, setCopied] = useState(false)
  const isHost = room.hostId === room.me
  const meta = getGame(room.gameId).getMetadata()
  const settings = room.settings as MltSettings
  const missing = room.minPlayers - room.players.length
  const source = settings.questionSource ?? 'all'

  const setting = <K extends keyof MltSettings>(key: K, value: MltSettings[K]) =>
    void send({ type: 'settings', settings: { ...settings, [key]: value } })

  const link = `${location.origin}${location.pathname}#/${room.code}`
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-4">
      <header className="pt-4 text-center">
        <p className="text-sm uppercase tracking-widest text-white/60">{meta.name}</p>
        <p className="mt-1 font-mono text-6xl font-extrabold tracking-[0.2em]" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code}
        </p>
        <button onClick={copy} className="mt-2 min-h-11 rounded-full border border-white/20 px-4 text-sm text-white/80">
          {copied ? 'Link copied ✓' : 'Copy invite link'}
        </button>
      </header>

      <Card>
        <h2 className="mb-3 font-semibold">
          Players <span className="text-white/60">({room.players.length}/{room.maxPlayers})</span>
        </h2>
        <ul className="space-y-2">
          {room.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
              <Avatar name={p.name} id={p.id} />
              <span className="min-w-0 flex-1 truncate">
                {p.name}
                {p.id === room.me && <span className="text-white/50"> (you)</span>}
              </span>
              {p.id === room.hostId && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-200">Host</span>}
              {isHost && p.id !== room.me && (
                <button className="min-h-11 px-2 text-sm text-rose-300" onClick={() => void send({ type: 'kick', targetId: p.id })}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isHost ? (
        <>
        <Card className="space-y-4">
          <h2 className="font-semibold">Game settings</h2>
          <Stepper label="Rounds" value={settings.rounds} min={1} max={30} onChange={(v) => setting('rounds', v)} />
          <Stepper label="Seconds per round" value={settings.roundSeconds} min={10} max={120} step={5} onChange={(v) => setting('roundSeconds', v)} />
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>Allow voting for yourself</span>
            <input type="checkbox" className="h-6 w-6 accent-fuchsia-500" checked={settings.allowSelfVote} onChange={(e) => setting('allowSelfVote', e.target.checked)} />
          </label>
          <div role="radiogroup" aria-label="Questions to use" className="space-y-2">
            <span>Questions to use</span>
            <div className="grid grid-cols-3 gap-2">
              {([['all', 'Mix'], ['builtin', 'Built-in'], ['custom', 'Mine only']] as const).map(([value, label]) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={source === value}
                  onClick={() => setting('questionSource', value)}
                  className={`min-h-11 rounded-xl border px-2 text-sm ${source === value ? 'border-fuchsia-300 bg-fuchsia-500/40 font-semibold' : 'border-white/20 bg-white/5'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/60">As host, you’ll see who has voted and who voted for whom. Other players only see the vote counts.</p>
        </Card>
        <QuestionsPanel code={room.code} />
        </>
      ) : (
        <p className="text-center text-white/70">Waiting for the host to start…</p>
      )}

      {isHost && (
        <Button disabled={missing > 0} onClick={() => void send({ type: 'start' })}>
          {missing > 0 ? `Waiting for ${missing} more player${missing === 1 ? '' : 's'}…` : 'Start game'}
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
