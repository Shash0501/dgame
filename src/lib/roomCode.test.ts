import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateRoomCode } from './roomCode.ts'

test('generates a code of the requested length', () => {
  assert.equal(generateRoomCode(5).length, 5)
})

test('only uses unambiguous characters', () => {
  assert.match(generateRoomCode(50), /^[A-HJ-NP-Z2-9]+$/)
})
