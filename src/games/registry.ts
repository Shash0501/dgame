import type { GameModule } from './types.ts'
import { mostLikelyTo } from './most-likely-to/logic.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any, any>

const modules: Record<string, AnyGameModule> = {
  'most-likely-to': mostLikelyTo,
}

export function getGame(id: string): AnyGameModule {
  const game = modules[id]
  if (!game) throw new Error(`Unknown game: ${id}`)
  return game
}

export function listGames() {
  return Object.values(modules).map((m) => m.getMetadata())
}
