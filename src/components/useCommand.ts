import { useState } from 'react'
import { backend } from '../lib/backend.ts'
import type { Command } from '../lib/room.ts'

export function useCommand(code: string) {
  const [error, setError] = useState('')
  // Resolves true on success. The new view reaches the screen through the
  // backend's subscription, so callers don't need to wait on it.
  async function send(command: Command): Promise<boolean> {
    try {
      await backend.send(code, command)
      setError('')
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  return { send, error }
}
