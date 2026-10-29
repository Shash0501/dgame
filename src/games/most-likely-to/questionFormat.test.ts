import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CUSTOM_QUESTIONS, normalizeQuestion, planAdd } from './questionFormat.ts'

const text = (raw: string) => {
  const n = normalizeQuestion(raw)
  return n.ok ? n.text : `ERR: ${n.reason}`
}

test('strips the "Who is most likely to" prefix, punctuation and list markers', () => {
  assert.equal(text('Who is most likely to get lost?'), 'get lost')
  assert.equal(text('who’s most likely to… adopt ten cats!'), 'adopt ten cats')
  assert.equal(text('Most likely to: win the lottery.'), 'win the lottery')
  assert.equal(text('  3.   laugh at   their own joke  '), 'laugh at their own joke')
  assert.equal(text('- cry at a wedding'), 'cry at a wedding')
})

test('rejects bad input', () => {
  assert.match(text('hi'), /too short/)
  assert.match(text('x'.repeat(101)), /too long/)
  assert.match(text('<script>alert(1)</script>'), /< or >/)
  assert.match(text('?!?!?!'), /needs some words/)
  assert.match(text('bad\u0000char'), /aren’t allowed/)
  assert.match(text('Who is most likely to ?'), /needs some words|too short/)
})

test('planAdd skips duplicates, invalid lines and respects the limit', () => {
  const plan = planAdd(['get lost', 'GET LOST', 'in builtin', 'hi', '', 'new idea here'], ['existing one'], ['in builtin'])
  assert.deepEqual(plan.accepted, ['get lost', 'new idea here'])
  assert.deepEqual(plan.skipped.map((s) => s.reason.split(' (')[0]), ['already in the list', 'already in the list', 'too short'])

  const many = Array.from({ length: 40 }, (_, i) => `question number ${i}`)
  const limited = planAdd(many, [], [])
  assert.equal(limited.accepted.length, MAX_CUSTOM_QUESTIONS)
  assert.equal(planAdd(['one more thing'], Array(MAX_CUSTOM_QUESTIONS).fill('x').map((x, i) => x + i), []).accepted.length, 0)
})
