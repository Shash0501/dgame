import { useState } from 'react'
import { backend } from '../lib/backend.ts'
import { Button, Card, ErrorText, inputClass } from './ui.tsx'

export default function Home() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function go(action: () => Promise<string>) {
    setBusy(true)
    try {
      location.hash = `/${await action()}`
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const create = () => go(() => backend.createRoom(name))
  const join = () =>
    go(async () => {
      const c = code.trim().toUpperCase()
      await backend.joinRoom(c, name)
      return c
    })

  return (
    <div className="space-y-6">
      <header className="pt-6 text-center">
        <p className="text-5xl" aria-hidden>🎉</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">dgame</h1>
        <p className="mt-1 text-white/70">Party games for your whole group. No sign-up needed.</p>
      </header>

      <Card className="space-y-3">
        <label className="block">
          <span className="text-sm text-white/70">Your name</span>
          <input className={`${inputClass} mt-1`} value={name} maxLength={20} placeholder="e.g. Sam" onChange={(e) => setName(e.target.value)} />
        </label>
        <Button disabled={busy || !name.trim()} onClick={create}>
          Create a room
        </Button>
      </Card>

      <Card className="space-y-3">
        <label className="block">
          <span className="text-sm text-white/70">Got a code from a friend?</span>
          <input
            className={`${inputClass} mt-1 text-center font-mono text-2xl uppercase tracking-[0.4em]`}
            placeholder="ABCDE"
            value={code}
            maxLength={5}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <Button variant="secondary" disabled={busy || !name.trim() || code.trim().length < 5} onClick={join}>
          Join room
        </Button>
      </Card>

      <ErrorText>{error}</ErrorText>
    </div>
  )
}
