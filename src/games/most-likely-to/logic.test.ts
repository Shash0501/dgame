import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mostLikelyTo as g, selectPool } from './logic.ts'
import { builtinContent } from './questions.ts'
import { GameError } from '../types.ts'

const ids = ['a', 'b', 'c', 'd']
const start = () => g.initializeGame(ids, { ...g.getDefaultSettings(), rounds: 2 }, 0, builtinContent)

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

test('timer closes the round and the game ends after the last round', () => {
  let s = g.tick(start(), 31_000)
  assert.equal(s.phase, 'results')
  s = g.advanceState(s, 32_000)
  assert.equal(s.round, 1)
  s = g.advanceState(g.advanceState(s, 33_000), 34_000)
  assert.equal(s.phase, 'done')
})

test('validates settings', () => {
  assert.ok(g.validateSettings({ ...g.getDefaultSettings(), rounds: 0 }))
  assert.equal(g.validateSettings(g.getDefaultSettings()), null)
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

test('starting fails clearly when the pool is too small', () => {
  const settings = { ...g.getDefaultSettings(), rounds: 3, questionSource: 'custom' as const }
  assert.throws(() => g.initializeGame(ids, settings, 0, mixed), (e) => e instanceof GameError && /Only 2 questions/.test(e.message))
  assert.throws(() => g.initializeGame(ids, settings, 0, { questions: [] }), /no questions/)
})

test('a game never repeats a question', () => {
  const s = g.initializeGame(ids, { ...g.getDefaultSettings(), rounds: 30 }, 0, builtinContent)
  assert.equal(new Set(s.questions).size, 30)
})
