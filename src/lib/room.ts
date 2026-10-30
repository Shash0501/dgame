import { getGame } from '../games/registry.ts'
import type { GameContent } from '../games/types.ts'

export interface Player {
  id: string
  name: string
}

export interface Room {
  code: string
  hostId: string
  players: Player[]
  status: 'lobby' | 'playing'
  gameId: string
  settings: unknown
  game: unknown
  maxPlayers: number
}

export class RoomError extends Error {}

export function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 1 || name.length > 20) throw new RoomError('Name must be 1–20 characters')
  return name
}

export function createRoom(code: string, hostId: string, hostName: string, gameId: string): Room {
  const game = getGame(gameId)
  return {
    code,
    hostId,
    players: [{ id: hostId, name: cleanName(hostName) }],
    status: 'lobby',
    gameId,
    settings: game.getDefaultSettings(),
    game: null,
    maxPlayers: game.getMetadata().maxPlayers,
  }
}

export function joinRoom(room: Room, playerId: string, rawName: string): Room {
  if (room.players.some((p) => p.id === playerId)) return room // reconnect
  const name = cleanName(rawName)
  if (room.status !== 'lobby') throw new RoomError('This game has already started')
  if (room.players.length >= room.maxPlayers) throw new RoomError('This room is full')
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new RoomError('That name is already taken')
  }
  return { ...room, players: [...room.players, { id: playerId, name }] }
}

function requireHost(room: Room, by: string) {
  if (room.hostId !== by) throw new RoomError('Only the host can do that')
}

export function updateSettings(room: Room, by: string, settings: unknown): Room {
  requireHost(room, by)
  if (room.status !== 'lobby') throw new RoomError('Settings are locked during a game')
  const error = getGame(room.gameId).validateSettings(settings)
  if (error) throw new RoomError(error)
  return { ...room, settings }
}

export function kickPlayer(room: Room, by: string, targetId: string): Room {
  requireHost(room, by)
  if (targetId === room.hostId) throw new RoomError('The host cannot be removed')
  if (room.status !== 'lobby') throw new RoomError('Players can only be removed in the lobby')
  return { ...room, players: room.players.filter((p) => p.id !== targetId) }
}

export function startGame(room: Room, by: string, now: number, content: GameContent): Room {
  requireHost(room, by)
  if (room.status !== 'lobby') throw new RoomError('Game already started')
  const game = getGame(room.gameId)
  const { minPlayers } = game.getMetadata()
  if (room.players.length < minPlayers) throw new RoomError(`Need at least ${minPlayers} players`)
  const state = game.initializeGame(room.players.map((p) => p.id), room.settings, now, content)
  return { ...room, status: 'playing', game: state }
}

export function gameAction(room: Room, by: string, action: unknown, now: number): Room {
  if (room.status !== 'playing') throw new RoomError('No game in progress')
  if (!room.players.some((p) => p.id === by)) throw new RoomError('You are not in this room')
  const game = getGame(room.gameId)
  return { ...room, game: game.handleAction(room.game, by, action, now) }
}

export function advance(room: Room, by: string, now: number): Room {
  requireHost(room, by)
  if (room.status !== 'playing') throw new RoomError('No game in progress')
  return { ...room, game: getGame(room.gameId).advanceState(room.game, now) }
}

// Host ends the game early and jumps everyone to the final summary. The game
// stays in progress (status 'playing', phase 'done') so all players see it;
// `end` is what returns the room to the lobby.
export function finishGame(room: Room, by: string, now: number): Room {
  requireHost(room, by)
  if (room.status !== 'playing') throw new RoomError('No game in progress')
  return { ...room, game: getGame(room.gameId).endNow(room.game, now) }
}

export function tick(room: Room, now: number): Room {
  if (room.status !== 'playing') return room
  const next = getGame(room.gameId).tick(room.game, now)
  return next === room.game ? room : { ...room, game: next }
}

export function endGame(room: Room, by: string): Room {
  requireHost(room, by)
  return { ...room, status: 'lobby', game: null }
}

// What a single client is allowed to see. The raw room (with every vote) never
// leaves the backend.
export interface RoomView {
  code: string
  me: string
  hostId: string
  players: Player[]
  status: Room['status']
  gameId: string
  settings: unknown
  maxPlayers: number
  minPlayers: number
  view: unknown
  serverNow: number
  // Row version from the backend; lets clients drop out-of-order responses.
  version?: number
}

export function toView(room: Room, playerId: string, now: number = Date.now()): RoomView {
  const game = getGame(room.gameId)
  return {
    code: room.code,
    me: playerId,
    hostId: room.hostId,
    players: room.players,
    status: room.status,
    gameId: room.gameId,
    settings: room.settings,
    maxPlayers: room.maxPlayers,
    minPlayers: game.getMetadata().minPlayers,
    view: room.status === 'playing' ? game.getPlayerView(room.game, playerId, playerId === room.hostId) : null,
    serverNow: now,
  }
}

export type Command =
  | { type: 'settings'; settings: unknown }
  | { type: 'kick'; targetId: string }
  | { type: 'start' }
  | { type: 'action'; action: unknown }
  | { type: 'advance' }
  | { type: 'finish' }
  | { type: 'end' }

export function applyCommand(
  room: Room,
  by: string,
  cmd: Command,
  now: number,
  content: GameContent = { questions: [] },
): Room {
  switch (cmd.type) {
    case 'settings':
      return updateSettings(room, by, cmd.settings)
    case 'kick':
      return kickPlayer(room, by, cmd.targetId)
    case 'start':
      return startGame(room, by, now, content)
    case 'action':
      return gameAction(room, by, cmd.action, now)
    case 'advance':
      return advance(room, by, now)
    case 'finish':
      return finishGame(room, by, now)
    case 'end':
      return endGame(room, by)
    default:
      throw new RoomError('Unknown command')
  }
}
