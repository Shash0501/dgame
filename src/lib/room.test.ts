import { test } from 'node:test'
import assert from 'node:assert/strict'
import { builtinContent } from '../games/most-likely-to/questions.ts'
import { advance, createRoom, gameAction, joinRoom, kickPlayer, startGame } from './room.ts'

function lobby(n = 4) {
  let r = createRoom('ABCDE', 'p0', 'Host', 'most-likely-to')
  for (let i = 1; i < n; i++) r = joinRoom(r, `p${i}`, `P${i}`)
  return r
}

test('duplicate names are rejected case-insensitively', () => {
  assert.throws(() => joinRoom(lobby(2), 'x', 'p1'))
})

test('only the host can start, and a minimum number of players is needed', () => {
  assert.throws(() => startGame(lobby(4), 'p1', 0, builtinContent))
  assert.throws(() => startGame(lobby(3), 'p0', 0, builtinContent))
  assert.equal(startGame(lobby(4), 'p0', 0, builtinContent).status, 'playing')
})

test('round does not close when everyone has voted; only the host reveals', () => {
  let r = startGame(lobby(4), 'p0', 0, builtinContent)
  for (let i = 0; i < 4; i++) r = gameAction(r, `p${i}`, { type: 'vote', targetId: `p${(i + 1) % 4}` }, 1)
  assert.equal((r.game as { phase: string }).phase, 'voting')
  assert.throws(() => advance(r, 'p1', 2))
  assert.equal((advance(r, 'p0', 2).game as { phase: string }).phase, 'results')
})

test('host can remove players but not themselves', () => {
  assert.equal(kickPlayer(lobby(4), 'p0', 'p2').players.length, 3)
  assert.throws(() => kickPlayer(lobby(4), 'p0', 'p0'))
})

test('player view never exposes other players’ votes before reveal', async () => {
  const { toView } = await import('./room.ts')
  let r = startGame(lobby(4), 'p0', 0, builtinContent)
  r = gameAction(r, 'p1', { type: 'vote', targetId: 'p2' }, 1)
  const json = JSON.stringify(toView(r, 'p3'))
  assert.ok(!json.includes('"votes"'))
  assert.equal((toView(r, 'p1').view as { myVote: string }).myVote, 'p2')
  assert.equal((toView(r, 'p3').view as { myVote: unknown }).myVote, null)
})
