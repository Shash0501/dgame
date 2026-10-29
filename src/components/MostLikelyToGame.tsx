import { useEffect, useState } from 'react'
import type { RoomView } from '../lib/room.ts'
import { backend, serverNow } from '../lib/backend.ts'
import { useCommand } from './useCommand.ts'
import { Avatar, Button, Card, ErrorText } from './ui.tsx'

interface Result {
  question: string
  counts: Record<string, number>
  winners: string[]
  votes?: Record<string, string> // host only
}
interface View {
  phase: 'voting' | 'results' | 'done'
  round: number
  totalRounds: number
  allowSelfVote: boolean
  deadline: number
  scores: Record<string, number>
  question?: string
  myVote?: string | null
  votedCount?: number
  allVoted?: boolean
  votedIds?: string[] // host only
  result?: Result
}

export default function MostLikelyToGame({ room }: { room: RoomView }) {
  const { send, error } = useCommand(room.code)
  const [now, setNow] = useState(serverNow())
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 250)
    return () => clearInterval(t)
  }, [])

  const view = room.view as View
  // Show a tapped vote instantly; the server's answer replaces it a moment later.
  const [pick, setPick] = useState<{ round: number; id: string } | null>(null)
  const myVote = pick && pick.round === view.round ? pick.id : view.myVote
  const vote = (id: string) => {
    setPick({ round: view.round, id })
    void send({ type: 'action', action: { type: 'vote', targetId: id } }).then((ok) => !ok && setPick(null))
  }

  // When the round timer runs out, ask the server to close the round once.
  // Skipped if everyone has voted: then the host decides when to reveal.
  useEffect(() => {
    if (view.phase !== 'voting' || view.allVoted) return
    const delay = Math.max(0, view.deadline - serverNow()) + 300 + Math.random() * 700
    const t = setTimeout(() => void backend.refresh(room.code), delay)
    return () => clearTimeout(t)
  }, [view.phase, view.allVoted, view.deadline, room.code])
  const isHost = room.hostId === room.me
  const player = (id: string) => room.players.find((p) => p.id === id)
  const name = (id: string) => player(id)?.name ?? 'Unknown'
  const header = `Round ${Math.min(view.round + 1, view.totalRounds)} of ${view.totalRounds}`

  if (view.phase === 'voting') {
    const totalMs = (room.settings as { roundSeconds: number }).roundSeconds * 1000
    const left = Math.max(0, view.deadline - now)
    const choices = room.players.filter((p) => view.allowSelfVote || p.id !== room.me)
    return (
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-white/70">
            <span>{header}</span>
            <span aria-live="off">{view.allVoted ? 'All votes in ✓' : `${Math.ceil(left / 1000)}s`}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.allVoted ? 100 : Math.round((left / totalMs) * 100)} aria-label="Time left">
            <div className={`h-full rounded-full transition-[width] duration-300 ${view.allVoted ? 'bg-emerald-400' : 'bg-gradient-to-r from-fuchsia-500 to-amber-400'}`} style={{ width: `${view.allVoted ? 100 : Math.min(100, (left / totalMs) * 100)}%` }} />
          </div>
        </div>

        <Card className="py-8 text-center">
          <p className="text-sm uppercase tracking-widest text-white/60">Who is most likely to…</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">{view.question}?</h1>
        </Card>

        <ul className="grid grid-cols-2 gap-3">
          {choices.map((p) => {
            const selected = myVote === p.id
            return (
              <li key={p.id}>
                <button
                  aria-pressed={selected}
                  onClick={() => vote(p.id)}
                  className={`relative flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border p-3 transition active:scale-95 ${selected ? 'border-fuchsia-300 bg-fuchsia-500/40 ring-2 ring-fuchsia-300' : 'border-white/15 bg-white/10'}`}
                >
                  <Avatar name={p.name} id={p.id} />
                  <span className="w-full truncate text-center font-medium">{p.name}</span>
                  {selected && <span className="absolute right-2 top-2 text-sm">✓</span>}
                  {isHost && view.votedIds?.includes(p.id) && <span className="text-xs text-emerald-300">has voted</span>}
                </button>
              </li>
            )
          })}
        </ul>

        <p className="text-center text-sm text-white/70" aria-live="polite">
          {myVote ? `You voted for ${name(myVote)}. You can change it until the answer is revealed.` : 'Tap a person to vote.'}
          {' '}
          {view.votedCount} of {room.players.length} voted.
        </p>

        {isHost ? (
          <Button variant={view.allVoted ? 'primary' : 'secondary'} onClick={() => void send({ type: 'advance' })}>
            {view.allVoted ? 'Everyone has voted: reveal the answer' : 'Reveal the answer now'}
          </Button>
        ) : (
          view.allVoted && <p className="text-center font-medium">Everyone has voted! Waiting for the host to reveal…</p>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    )
  }

  const result = view.result!
  const ranked = [...room.players].sort((a, b) => (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0))
  const max = Math.max(1, ...Object.values(result.counts))
  const byCount = [...room.players].sort((a, b) => (result.counts[b.id] ?? 0) - (result.counts[a.id] ?? 0))
  const lastRound = view.round + 1 >= view.totalRounds

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-white/70">{view.phase === 'done' ? 'Final round results' : header}</p>
      <Card className="text-center">
        <p className="text-sm text-white/60">Most likely to {result.question}</p>
        {result.winners.length === 0 ? (
          <p className="mt-2 text-2xl font-bold">Nobody voted 🤷</p>
        ) : (
          <>
            <p className="mt-2 text-4xl" aria-hidden>{result.winners.length > 1 ? '🤝' : '👑'}</p>
            <p className="text-2xl font-extrabold">
              {result.winners.length > 1 ? `It’s a tie: ${result.winners.map(name).join(' & ')}` : name(result.winners[0])}
            </p>
          </>
        )}
      </Card>

      <ul className="space-y-2">
        {byCount.map((p) => {
          const count = result.counts[p.id] ?? 0
          const winner = result.winners.includes(p.id)
          const voters = result.votes ? Object.entries(result.votes).filter(([, t]) => t === p.id).map(([v]) => name(v)) : null
          return (
            <li key={p.id} className={`rounded-2xl border p-3 ${winner ? 'border-amber-300/60 bg-amber-300/15' : 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center gap-3">
                <Avatar name={p.name} id={p.id} size="sm" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-bold">{count}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${winner ? 'bg-amber-300' : 'bg-fuchsia-400'}`} style={{ width: `${(count / max) * 100}%` }} />
              </div>
              {voters && voters.length > 0 && <p className="mt-2 text-xs text-white/60">Voted by: {voters.join(', ')}</p>}
            </li>
          )
        })}
      </ul>
      {isHost && <p className="text-center text-xs text-white/50">Only you can see who voted for whom.</p>}

      {view.phase === 'done' && (
        <Card>
          <h2 className="mb-2 font-semibold">🏆 Final scores</h2>
          <ol className="space-y-2">
            {ranked.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-6 text-center text-white/60">{i + 1}</span>
                <Avatar name={p.name} id={p.id} size="sm" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-bold">{view.scores[p.id]}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {isHost && view.phase === 'results' && <Button onClick={() => void send({ type: 'advance' })}>{lastRound ? 'Finish game' : 'Next round'}</Button>}
      {isHost && view.phase === 'done' && <Button onClick={() => void send({ type: 'end' })}>Back to lobby</Button>}
      {!isHost && view.phase !== 'done' && <p className="text-center text-white/70">Waiting for the host…</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
