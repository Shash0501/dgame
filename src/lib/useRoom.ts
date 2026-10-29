import { useEffect, useState } from 'react'
import { backend } from './backend.ts'
import type { RoomView } from './room.ts'

// undefined = loading, null = room missing/expired.
export function useRoom(code: string): RoomView | null | undefined {
  const [view, setView] = useState<RoomView | null | undefined>(undefined)
  useEffect(() => {
    setView(undefined)
    return backend.subscribe(code, setView)
  }, [code])
  return view
}
