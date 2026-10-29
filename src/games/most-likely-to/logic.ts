import { GameError } from '../types.ts'
import type { GameContent, GameModule } from '../types.ts'

export type QuestionSource = 'all' | 'custom' | 'builtin'

export interface MltSettings {
  rounds: number
  roundSeconds: number
  allowSelfVote: boolean
  questionSource: QuestionSource
}

export interface RoundResult {
  question: string
  counts: Record<string, number>
  winners: string[]
  // voter id -> target id. Only ever sent to the host.
  votes: Record<string, string>
}

export interface MltState {
  settings: MltSettings
  playerIds: string[]
  questions: string[]
  round: number
  phase: 'voting' | 'results' | 'done'
  deadline: number
  votes: Record<string, string>
  history: RoundResult[]
  scores: Record<string, number>
}

export type MltAction = { type: 'vote'; targetId: string }

export const MAX_ROUNDS = 50
const SOURCES: QuestionSource[] = ['all', 'custom', 'builtin']

export const allVoted = (s: MltState) => s.playerIds.every((id) => id in s.votes)

// Unique question texts allowed by the host's chosen source.
export function selectPool(content: GameContent, source: QuestionSource): string[] {
  const seen = new Set<string>()
  const pool: string[] = []
  for (const q of content.questions) {
    if (source !== 'all' && q.source !== source) continue
    const key = q.text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    pool.push(q.text)
  }
  return pool
}

export function pickQuestions(pool: string[], count: number, rng: () => number = Math.random): string[] {
  const copy = [...pool]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export function closeRound(state: MltState): MltState {
  const counts: Record<string, number> = {}
  for (const id of state.playerIds) counts[id] = 0
  for (const target of Object.values(state.votes)) counts[target] += 1
  const max = Math.max(0, ...Object.values(counts))
  const winners = max > 0 ? state.playerIds.filter((id) => counts[id] === max) : []
  const scores = { ...state.scores }
  for (const id of state.playerIds) scores[id] += counts[id]
  const result: RoundResult = { question: state.questions[state.round], counts, winners, votes: { ...state.votes } }
  return { ...state, phase: 'results', scores, history: [...state.history, result] }
}

export const mostLikelyTo: GameModule<MltState, MltAction, MltSettings> = {
  getMetadata: () => ({
    id: 'most-likely-to',
    name: 'Most Likely To',
    description: 'Vote for the player who best fits each prompt.',
    minPlayers: 4,
    maxPlayers: 14,
    supportsScoring: true,
  }),

  getDefaultSettings: () => ({ rounds: 5, roundSeconds: 30, allowSelfVote: false, questionSource: 'all' }),

  validateSettings(s) {
    if (!Number.isInteger(s.rounds) || s.rounds < 1 || s.rounds > MAX_ROUNDS) {
      return `Rounds must be between 1 and ${MAX_ROUNDS}`
    }
    if (!Number.isInteger(s.roundSeconds) || s.roundSeconds < 5 || s.roundSeconds > 300) {
      return 'Round time must be between 5 and 300 seconds'
    }
    if (!SOURCES.includes(s.questionSource ?? 'all')) return 'Unknown question source'
    return null
  },

  initializeGame(playerIds, settings, now, content) {
    const pool = selectPool(content, settings.questionSource ?? 'all')
    if (pool.length < settings.rounds) {
      throw new GameError(
        pool.length === 0
          ? 'There are no questions to use with this setting. Add some questions or change the question source.'
          : `Only ${pool.length} question${pool.length === 1 ? ' is' : 's are'} available with this setting, but you chose ${settings.rounds} rounds. Add more questions or lower the rounds.`,
      )
    }
    const scores: Record<string, number> = {}
    for (const id of playerIds) scores[id] = 0
    return {
      settings,
      playerIds,
      questions: pickQuestions(pool, settings.rounds),
      round: 0,
      phase: 'voting',
      deadline: now + settings.roundSeconds * 1000,
      votes: {},
      history: [],
      scores,
    }
  },

  handleAction(state, playerId, action, now) {
    if (action.type !== 'vote') throw new GameError('Unknown action')
    // Once everyone has voted the round stays open (changes allowed) until the host reveals.
    if (state.phase !== 'voting' || (now >= state.deadline && !allVoted(state))) throw new GameError('Voting is closed')
    if (!state.playerIds.includes(playerId)) throw new GameError('You are not in this game')
    if (!state.playerIds.includes(action.targetId)) throw new GameError('Invalid player selected')
    if (!state.settings.allowSelfVote && action.targetId === playerId) {
      throw new GameError('You cannot vote for yourself')
    }
    return { ...state, votes: { ...state.votes, [playerId]: action.targetId } }
  },

  advanceState(state, now) {
    if (state.phase === 'voting') return closeRound(state)
    if (state.phase === 'results') {
      if (state.round + 1 >= state.settings.rounds) return { ...state, phase: 'done' }
      return {
        ...state,
        round: state.round + 1,
        phase: 'voting',
        votes: {},
        deadline: now + state.settings.roundSeconds * 1000,
      }
    }
    return state
  },

  tick(state, now) {
    return state.phase === 'voting' && now >= state.deadline && !allVoted(state) ? closeRound(state) : state
  },

  getPlayerView(state, playerId, isHost) {
    const base = {
      phase: state.phase,
      round: state.round,
      totalRounds: state.settings.rounds,
      deadline: state.deadline,
      scores: state.scores,
      allowSelfVote: state.settings.allowSelfVote,
    }
    // Who voted for whom is host-only; everyone else gets counts.
    const publicResult = (r: RoundResult) => (isHost ? r : { ...r, votes: undefined })
    if (state.phase === 'voting') {
      return {
        ...base,
        question: state.questions[state.round],
        myVote: state.votes[playerId] ?? null,
        votedCount: Object.keys(state.votes).length,
        allVoted: allVoted(state),
        votedIds: isHost ? Object.keys(state.votes) : undefined,
      }
    }
    const history = state.history.map(publicResult)
    return { ...base, history, result: history[history.length - 1] }
  },
}
