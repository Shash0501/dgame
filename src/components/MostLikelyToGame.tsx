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
  isLastQuestion: boolean
  roundSeconds: number
  scores: Record<string, number>
  question?: string
  deadline?: number
  myVote?: string | null
  votedCount?: number
  allVoted?: boolean
  votedIds?: string[] // host only
  result?: Result
  history?: Result[]
}

export default function MostLikelyToGame({ room }: { room: RoomView }) {
  const { send, error } = useCommand(room.code)
  const view = room.view as View
  const isHost = room.hostId === room.me
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? 'Unknown'

  // Show a tapped vote instantly; the server's answer replaces it a moment later.
  const [pick, setPick] = useState<{ round: number; id: string } | null>(null)
  const myVote = pick && pick.round === view.round ? pick.id : view.myVote
  const vote = (id: string) => {
    setPick({ round: view.round, id })
    void send({ type: 'action', action: { type: 'vote', targetId: id } }).then((ok) => !ok && setPick(null))
  }

  // Disable a host transition button the moment it's tapped, so a slow round
  // trip can't make it feel unresponsive or be double-fired.
  const [pending, setPending] = useState(false)
  const act = (command: Parameters<typeof send>[0]) => {
    setPending(true)
    void send(command).finally(() => setPending(false))
  }

  // Ticks the countdown display.
  const [now, setNow] = useState(serverNow())
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 250)
    return () => clearInterval(t)
  }, [])

  // When the round deadline passes, ask the server to close the round once.
  // Skipped if everyone has voted: then the host decides when to reveal.
  const deadline = view.deadline ?? 0
  useEffect(() => {
    if (view.phase !== 'voting' || view.allVoted) return
    const delay = Math.max(0, deadline - serverNow()) + 300 + Math.random() * 700
    const t = setTimeout(() => void backend.refresh(room.code), delay)
    return () => clearTimeout(t)
  }, [view.phase, view.allVoted, deadline, room.code])

  if (view.phase === 'done') return <Summary room={room} view={view} isHost={isHost} name={name} send={act} pending={pending} error={error} />

  const header = `Question ${view.round + 1}${view.isLastQuestion ? ' (last one)' : ''}`

  if (view.phase === 'voting') {
    const choices = room.players.filter((p) => view.allowSelfVote || p.id !== room.me)
    const totalMs = view.roundSeconds * 1000
    const left = Math.max(0, deadline - now)
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>{header}</span>
            <span className={view.allVoted ? 'font-medium text-emerald-300' : ''}>
              {view.allVoted ? 'All votes in ✓' : `${Math.ceil(left / 1000)}s · ${view.votedCount}/${room.players.length} voted`}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.allVoted ? 100 : Math.round((left / totalMs) * 100)} aria-label="Time left">
            <div className={`h-full rounded-full transition-[width] duration-300 ${view.allVoted ? 'bg-emerald-400' : 'bg-gradient-to-r from-fuchsia-500 to-amber-400'}`} style={{ width: `${view.allVoted ? 100 : Math.min(100, (left / totalMs) * 100)}%` }} />
          </div>
        </div>

        <Card className="bg-gradient-to-br from-fuchsia-600/40 to-indigo-600/30 py-10 text-center">
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
                  {isHost && view.votedIds?.includes(p.id) && <span className="text-xs text-emerald-300">voted</span>}
                </button>
              </li>
            )
          })}
        </ul>

        <p className="text-center text-sm text-white/70" aria-live="polite">
          {myVote ? `You voted for ${name(myVote)}. You can change it until the answer is revealed.` : 'Tap a person to vote.'}
        </p>

        {isHost ? (
          <div className="space-y-2">
            <Button variant={view.allVoted ? 'primary' : 'secondary'} disabled={pending} onClick={() => act({ type: 'advance' })}>
              {view.allVoted ? 'Reveal the answer' : 'Reveal now (before everyone votes)'}
            </Button>
            <EndGameButton onEnd={() => act({ type: 'finish' })} pending={pending} />
          </div>
        ) : (
          view.allVoted && <p className="text-center font-medium">Everyone has voted! Waiting for the host to reveal…</p>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    )
  }

  // Results of a single round.
  const result = view.result!
  const max = Math.max(1, ...Object.values(result.counts))
  const byCount = [...room.players].sort((a, b) => (result.counts[b.id] ?? 0) - (result.counts[a.id] ?? 0))

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-white/70">{header} · results</p>
      <WinnerCard result={result} name={name} />
      <VoteBars players={byCount} result={result} max={max} name={name} showVoters={isHost} />
      {isHost && <p className="text-center text-xs text-white/50">Only you can see who voted for whom.</p>}

      {isHost ? (
        <div className="space-y-2">
          <Button disabled={pending} onClick={() => act({ type: view.isLastQuestion ? 'finish' : 'advance' })}>
            {view.isLastQuestion ? 'No more questions — see the summary' : 'Next question'}
          </Button>
          <EndGameButton onEnd={() => act({ type: 'finish' })} pending={pending} label="End game & show summary" />
        </div>
      ) : (
        <p className="text-center text-white/70">Waiting for the host…</p>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

function WinnerCard({ result, name }: { result: Result; name: (id: string) => string }) {
  return (
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
  )
}

function VoteBars({
  players,
  result,
  max,
  name,
  showVoters,
}: {
  players: RoomView['players']
  result: Result
  max: number
  name: (id: string) => string
  showVoters: boolean
}) {
  return (
    <ul className="space-y-2">
      {players.map((p) => {
        const count = result.counts[p.id] ?? 0
        const winner = result.winners.includes(p.id)
        const voters = showVoters && result.votes ? Object.entries(result.votes).filter(([, t]) => t === p.id).map(([v]) => name(v)) : null
        return (
          <li key={p.id} className={`rounded-2xl border p-3 ${winner ? 'border-amber-300/60 bg-amber-300/15' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-center gap-3">
              <Avatar name={p.name} id={p.id} size="sm" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="font-bold">{count}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full transition-[width] duration-500 ${winner ? 'bg-amber-300' : 'bg-fuchsia-400'}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            {voters && voters.length > 0 && <p className="mt-2 text-xs text-white/60">Voted by: {voters.join(', ')}</p>}
          </li>
        )
      })}
    </ul>
  )
}

// Final summary, shown to everyone.
function Summary({
  room,
  view,
  isHost,
  name,
  send,
  pending,
  error,
}: {
  room: RoomView
  view: View
  isHost: boolean
  name: (id: string) => string
  send: (command: Parameters<ReturnType<typeof useCommand>['send']>[0]) => void
  pending: boolean
  error: string
}) {
  const ranked = [...room.players].sort((a, b) => (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0))
  const topScore = ranked.length ? view.scores[ranked[0].id] ?? 0 : 0
  const champions = ranked.filter((p) => (view.scores[p.id] ?? 0) === topScore && topScore > 0)
  const history = view.history ?? []

  return (
    <div className="space-y-4">
      <header className="pt-4 text-center">
        <p className="text-5xl" aria-hidden>🏆</p>
        <h1 className="mt-1 text-3xl font-extrabold">Game over!</h1>
        <p className="text-white/70">{history.length} question{history.length === 1 ? '' : 's'} played</p>
      </header>

      <Card className="text-center">
        {champions.length === 0 ? (
          <p className="text-xl font-bold">No votes were cast</p>
        ) : (
          <>
            <p className="text-sm uppercase tracking-widest text-white/60">Most voted overall</p>
            <p className="mt-2 text-2xl font-extrabold">{champions.map((p) => p.name).join(' & ')}</p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Leaderboard</h2>
        <ol className="space-y-2">
          {ranked.map((p, i) => {
            const score = view.scores[p.id] ?? 0
            const top = score === topScore && topScore > 0
            return (
              <li key={p.id} className={`flex items-center gap-3 rounded-xl p-2 ${top ? 'bg-amber-300/15' : ''}`}>
                <span className="w-6 text-center text-lg">{i === 0 && top ? '🥇' : i === 1 && top === false ? `${i + 1}` : i + 1}</span>
                <Avatar name={p.name} id={p.id} size="sm" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-bold">{score}</span>
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-xs text-white/50">Score = total votes received across all questions.</p>
      </Card>

      {history.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Every question</h2>
          <ul className="space-y-3">
            {history.map((r, i) => (
              <li key={i} className="border-b border-white/10 pb-3 last:border-0 last:pb-0">
                <p className="text-sm text-white/70">Most likely to {r.question}</p>
                <p className="font-semibold">
                  {r.winners.length === 0
                    ? '— nobody voted'
                    : `${r.winners.length > 1 ? '🤝 ' : '👑 '}${r.winners.map(name).join(' & ')}`}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isHost ? (
        <Button disabled={pending} onClick={() => send({ type: 'end' })}>
          Back to lobby
        </Button>
      ) : (
        <p className="text-center text-white/70">Thanks for playing! Waiting for the host…</p>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// End game needs a confirm, since it stops play for everyone.
function EndGameButton({ onEnd, pending, label = 'End game' }: { onEnd: () => void; pending: boolean; label?: string }) {
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <Button variant="danger" disabled={pending} onClick={() => setConfirm(true)}>
        {label}
      </Button>
    )
  }
  return (
    <div className="flex gap-2">
      <Button variant="danger" disabled={pending} onClick={onEnd}>
        End now
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => setConfirm(false)}>
        Keep playing
      </Button>
    </div>
  )
}
