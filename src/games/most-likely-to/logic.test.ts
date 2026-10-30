import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mostLikelyTo as g, selectPool } from './logic.ts'
import { builtinContent } from './questions.ts'
import { GameError } from '../types.ts'

const ids = ['a', 'b', 'c', 'd']
// A small, fixed pool keeps the "plays through everything" tests predictable.
const threeQ = { questions: [
  { text: 'eat pizza', source: 'builtin' as const },
  { text: 'adopt ten cats', source: 'builtin' as const },
  { text: 'run a marathon', source: 'builtin' as const },
] }
const start = () => g.initializeGame(ids, g.getDefaultSettings(), 0, threeQ)

test('rejects self votes by default and votes after the deadline', () => {
  const s = start()
  assert.throws(() => g.handleAction(s, 'a', { type: 'vote', targetId: 'a' }, 1))
  assert.throws(() => g.handleAction(s, 'a', { type: 'vote', targetId: 'b' }, 31_000))
})

test('a re-vote replaces the previous vote', () => {
  let s = start()
  s = g.handleAction(s, 'a', { type: 'vote', targetId: 'b' }, 1)
  s = g.handleAction(s, 'a', { type: 'vote', targetId: 'c' }, 2)
  assert.deepEqual(s.votes, { a: 'c' })
})

test('ties highlight every top player and votes stay hidden while voting', () => {
  let s = start()
  s = g.handleAction(s, 'a', { type: 'vote', targetId: 'b' }, 1)
  s = g.handleAction(s, 'b', { type: 'vote', targetId: 'c' }, 1)
  const view = g.getPlayerView(s, 'c', false) as { myVote: unknown; votedIds?: unknown; votedCount: number }
  assert.equal(view.myVote, null)
  assert.equal(view.votedIds, undefined)
  assert.equal(view.votedCount, 2)
  assert.deepEqual((g.getPlayerView(s, 'a', true) as { votedIds: string[] }).votedIds, ['a', 'b'])
  s = g.advanceState(s, 2)
  assert.deepEqual(s.history[0].winners, ['b', 'c'])
})

test('timer closes the round, and the game plays through every question', () => {
  let s = g.tick(start(), 31_000)
  assert.equal(s.phase, 'results')
  s = g.advanceState(s, 32_000) // -> question 2
  assert.equal(s.round, 1)
  assert.equal((g.getPlayerView(s, 'a', false) as { isLastQuestion: boolean }).isLastQuestion, false)
  s = g.advanceState(g.advanceState(s, 33_000), 34_000) // close q2 -> q3
  assert.equal(s.round, 2)
  assert.equal((g.getPlayerView(s, 'a', false) as { isLastQuestion: boolean }).isLastQuestion, true)
  s = g.advanceState(g.advanceState(s, 35_000), 36_000) // close q3 -> done (pool exhausted)
  assert.equal(s.phase, 'done')
})

test('the timer has no upper bound but must be a positive integer', () => {
  assert.equal(g.validateSettings({ ...g.getDefaultSettings(), roundSeconds: 9999 }), null)
  assert.ok(g.validateSettings({ ...g.getDefaultSettings(), roundSeconds: 0 }))
  assert.ok(g.validateSettings({ ...g.getDefaultSettings(), roundSeconds: 1.5 }))
  assert.equal(g.validateSettings(g.getDefaultSettings()), null)
})

test('host can end the game from any phase, counting an in-progress round', () => {
  // During voting, with votes cast: the round is scored, then done.
  let s = start()
  s = g.handleAction(s, 'a', { type: 'vote', targetId: 'b' }, 1)
  const ended = g.endNow(s, 2)
  assert.equal(ended.phase, 'done')
  assert.equal(ended.history.length, 1)
  assert.equal(ended.scores['b'], 1)

  // During voting with no votes: just ends, no empty round recorded.
  assert.equal(g.endNow(start(), 2).history.length, 0)

  // From results: ends without adding a round.
  const afterRound = g.advanceState(g.handleAction(start(), 'a', { type: 'vote', targetId: 'b' }, 1), 2)
  assert.equal(g.endNow(afterRound, 3).phase, 'done')
  assert.equal(g.endNow(afterRound, 3).history.length, 1)
})

test('who voted for whom is only visible to the host after the round', () => {
  let s = start()
  s = g.handleAction(s, 'a', { type: 'vote', targetId: 'b' }, 1)
  s = g.advanceState(s, 2)
  const last = (v: unknown) => (v as { result: { votes?: unknown } }).result
  assert.deepEqual(last(g.getPlayerView(s, 'a', true)).votes, { a: 'b' })
  assert.equal(last(g.getPlayerView(s, 'c', false)).votes, undefined)
  assert.equal(JSON.stringify(g.getPlayerView(s, 'c', false)).includes('"a":"b"'), false)
})

test('the full summary (history + scores) is visible to every player', () => {
  let s = start()
  s = g.handleAction(s, 'a', { type: 'vote', targetId: 'b' }, 1)
  s = g.endNow(s, 2)
  const playerView = g.getPlayerView(s, 'c', false) as { phase: string; history: unknown[]; scores: Record<string, number> }
  assert.equal(playerView.phase, 'done')
  assert.equal(playerView.history.length, 1)
  assert.equal(playerView.scores['b'], 1)
})

test('once everyone has voted the round stays open until the host reveals', () => {
  let s = start()
  for (const [v, t] of [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']]) s = g.handleAction(s, v, { type: 'vote', targetId: t }, 1)
  assert.equal(s.phase, 'voting')
  assert.equal(g.tick(s, 99_000).phase, 'voting') // deadline passed, still waiting for the host
  s = g.handleAction(s, 'a', { type: 'vote', targetId: 'c' }, 99_000) // can still change
  assert.equal(g.advanceState(s, 99_001).phase, 'results')
})

const mixed = {
  questions: [
    { text: 'eat pizza', source: 'builtin' as const },
    { text: 'Eat Pizza', source: 'custom' as const },
    { text: 'adopt ten cats', source: 'custom' as const },
  ],
}

test('question source filters the pool and drops duplicates', () => {
  assert.deepEqual(selectPool(mixed, 'all'), ['eat pizza', 'adopt ten cats'])
  assert.deepEqual(selectPool(mixed, 'custom'), ['Eat Pizza', 'adopt ten cats'])
  assert.deepEqual(selectPool(mixed, 'builtin'), ['eat pizza'])
})

test('starting fails only when the pool is empty', () => {
  const settings = { ...g.getDefaultSettings(), questionSource: 'custom' as const }
  assert.equal(g.initializeGame(ids, settings, 0, mixed).questions.length, 2)
  assert.throws(() => g.initializeGame(ids, { ...g.getDefaultSettings(), questionSource: 'builtin' }, 0, { questions: [] }), /no questions/)
})

test('a game shuffles in the whole pool without repeats', () => {
  const s = g.initializeGame(ids, g.getDefaultSettings(), 0, builtinContent)
  assert.equal(s.questions.length, builtinContent.questions.length)
  assert.equal(new Set(s.questions).size, s.questions.length)
})
