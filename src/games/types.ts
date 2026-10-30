export interface GameMetadata {
  id: string
  name: string
  description: string
  minPlayers: number
  maxPlayers: number
  supportsScoring: boolean
}

// Content a game draws on (e.g. its question pool), loaded by the backend.
export interface GameContent {
  questions: { text: string; source: 'builtin' | 'custom' }[]
}

// Contract every game module implements. Platform code (rooms, lobby, sync)
// only talks to games through this interface.
export interface GameModule<State, Action, Settings> {
  getMetadata(): GameMetadata
  getDefaultSettings(): Settings
  // Returns an error message, or null when valid.
  validateSettings(settings: Settings): string | null
  // Throws GameError when it can't start (e.g. not enough content).
  initializeGame(playerIds: string[], settings: Settings, now: number, content: GameContent): State
  // Throws GameError when the action is invalid.
  handleAction(state: State, playerId: string, action: Action, now: number): State
  advanceState(state: State, now: number): State
  // Host ends the game now, from any phase, jumping to the final summary.
  endNow(state: State, now: number): State
  // Moves time-based transitions forward (e.g. round deadlines).
  tick(state: State, now: number): State
  // isHost lets a game expose extra data (e.g. who voted) to the host only.
  getPlayerView(state: State, playerId: string, isHost: boolean): unknown
}

export class GameError extends Error {}
