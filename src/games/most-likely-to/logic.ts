import { GameError } from '../types.ts'
import type { GameContent, GameModule } from '../types.ts'

export type QuestionSource = 'all' | 'custom' | 'builtin'

export interface MltSettings {
  // Seconds a round stays open. Host-chosen with no fixed range.
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
  // The full shuffled pool. The game plays through every question, in order,
  // until it's exhausted or the host ends it.
  questions: string[]
  round: number
  phase: 'voting' | 'results' | 'done'
  deadline: number
  votes: Record<string, string>
  history: RoundResult[]
  scores: Record<string, number>
}

export type MltAction = { type: 'vote'; targetId: string }

const SOURCES: QuestionSource[] = ['all', 'custom', 'builtin']

export const allVoted = (s: MltState) => s.playerIds.every((id) => id in s.votes)
export const isLastQuestion = (s: MltState) => s.round + 1 >= s.questions.length

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

export function shuffle(pool: string[], rng: () => number = Math.random): string[] {
  const copy = [...pool]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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

  getDefaultSettings: () => ({ roundSeconds: 30, allowSelfVote: false, questionSource: 'all' }),

  validateSettings(s) {
    // No upper bound on the timer; just a sane positive integer.
    if (!Number.isInteger(s.roundSeconds) || s.roundSeconds < 1) return 'Round time must be at least 1 second'
    if (!SOURCES.includes(s.questionSource ?? 'all')) return 'Unknown question source'
    if (typeof s.allowSelfVote !== 'boolean') return 'Invalid setting'
    return null
  },

  initializeGame(playerIds, settings, now, content) {
    const pool = selectPool(content, settings.questionSource ?? 'all')
    if (pool.length === 0) {
      throw new GameError('There are no questions to use with this setting. Add some questions or change the question source.')
    }
    const scores: Record<string, number> = {}
    for (const id of playerIds) scores[id] = 0
    return {
      settings,
      playerIds,
      questions: shuffle(pool),
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
      if (isLastQuestion(state)) return { ...state, phase: 'done' } // ran out of questions
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

  // Host ends the game early, from any phase. An in-progress round with at
  // least one vote is counted before the summary.
  endNow(state) {
    if (state.phase === 'done') return state
    if (state.phase === 'voting' && Object.keys(state.votes).length > 0) {
      return { ...closeRound(state), phase: 'done' }
    }
    return { ...state, phase: 'done' }
  },

  tick(state, now) {
    return state.phase === 'voting' && now >= state.deadline && !allVoted(state) ? closeRound(state) : state
  },

  getPlayerView(state, playerId, isHost) {
    const base = {
      phase: state.phase,
      round: state.round,
      totalRounds: state.questions.length,
      roundSeconds: state.settings.roundSeconds,
      scores: state.scores,
      allowSelfVote: state.settings.allowSelfVote,
    }
    // Who voted for whom is host-only; everyone else gets counts.
    const publicResult = (r: RoundResult) => (isHost ? r : { ...r, votes: undefined })
    if (state.phase === 'voting') {
      return {
        ...base,
        question: state.questions[state.round],
        isLastQuestion: isLastQuestion(state),
        deadline: state.deadline,
        myVote: state.votes[playerId] ?? null,
        votedCount: Object.keys(state.votes).length,
        allVoted: allVoted(state),
        votedIds: isHost ? Object.keys(state.votes) : undefined,
      }
    }
    const history = state.history.map(publicResult)
    return {
      ...base,
      isLastQuestion: isLastQuestion(state),
      history,
      result: history[history.length - 1],
    }
  },
}
