import { useEffect, useState } from 'react'
import Home from './components/Home.tsx'
import Lobby from './components/Lobby.tsx'
import MostLikelyToGame from './components/MostLikelyToGame.tsx'
import { useRoom } from './lib/useRoom.ts'
import { backend } from './lib/backend.ts'
import { Button, Card, ErrorText, inputClass } from './components/ui.tsx'

function useCode(): string {
  const read = () => location.hash.replace(/^#\/?/, '').toUpperCase()
  const [code, setCode] = useState(read)
  useEffect(() => {
    const fn = () => setCode(read())
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  return code
}

function JoinForm({ code }: { code: string }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  return (
    <Card className="mt-10 space-y-3">
      <h1 className="text-2xl font-bold">Join room <span className="font-mono">{code}</span></h1>
      <input className={inputClass} placeholder="Your name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
      <Button disabled={!name.trim()} onClick={() => backend.joinRoom(code, name).catch((e: Error) => setError(e.message))}>
        Join
      </Button>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

function RoomView({ code }: { code: string }) {
  const room = useRoom(code)

  if (room === undefined) return <p className="mt-20 text-center text-white/70" role="status">Loading…</p>
  if (room === null) {
    return (
      <Card className="mt-10 space-y-3 text-center">
        <p className="text-4xl" aria-hidden>😕</p>
        <p role="alert">This room doesn’t exist or has expired.</p>
        <a className="inline-block min-h-11 py-2 underline" href="#/">Back home</a>
      </Card>
    )
  }
  if (!room.players.some((p) => p.id === room.me)) return <JoinForm code={code} />
  return room.status === 'lobby' ? <Lobby room={room} /> : <MostLikelyToGame room={room} />
}

export default function App() {
  const code = useCode()
  return <main className="mx-auto max-w-md px-4 pb-10 pt-2">{code ? <RoomView code={code} /> : <Home />}</main>
}
