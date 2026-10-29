// Rules for host-written questions. Pure, so the browser (live preview) and the
// Edge Function (authoritative check) behave identically.
export const MIN_LENGTH = 5
export const MAX_LENGTH = 100
export const MAX_CUSTOM_QUESTIONS = 30
export const MAX_LINES_PER_REQUEST = 50

// "Who is most likely to", "Who's most likely to", "Most likely to", plus any
// separator the host typed after it.
const PREFIX = /^(?:who(?:\s+is|['’]s)\s+)?most\s+likely\s+to\b[\s:,\-–—.…]*/i

export type Normalized = { ok: true; text: string } | { ok: false; reason: string }

export function normalizeQuestion(raw: string): Normalized {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw)) return { ok: false, reason: 'contains characters that aren’t allowed' }
  let text = raw.replace(/\s+/g, ' ').trim()
  text = text.replace(/^(?:[-*•]|\d+[.)])\s+/, '') // bullets / numbering pasted from a list
  text = text.replace(PREFIX, '') // we add "Who is most likely to" ourselves
  text = text.replace(/[\s?.!…]+$/, '').trim()
  if (/[<>]/.test(text)) return { ok: false, reason: 'can’t contain < or >' }
  if (!/\p{L}/u.test(text)) return { ok: false, reason: 'needs some words' }
  if (text.length < MIN_LENGTH) return { ok: false, reason: `too short (at least ${MIN_LENGTH} characters)` }
  if (text.length > MAX_LENGTH) return { ok: false, reason: `too long (at most ${MAX_LENGTH} characters)` }
  return { ok: true, text }
}

export interface AddPlan {
  accepted: string[]
  skipped: { text: string; reason: string }[]
}

// Decides which lines to save. `existing` are the room's current custom
// questions; `builtin` the library, so duplicates of either are skipped.
export function planAdd(lines: string[], existing: string[], builtin: string[], max = MAX_CUSTOM_QUESTIONS): AddPlan {
  const seen = new Set([...existing, ...builtin].map((t) => t.toLowerCase()))
  const accepted: string[] = []
  const skipped: AddPlan['skipped'] = []
  const capacity = Math.max(0, max - existing.length)
  const nonEmpty = lines.filter((l) => l.trim())
  for (const line of nonEmpty.slice(0, MAX_LINES_PER_REQUEST)) {
    const n = normalizeQuestion(line)
    if (!n.ok) {
      skipped.push({ text: line.trim().slice(0, 80), reason: n.reason })
      continue
    }
    const key = n.text.toLowerCase()
    if (seen.has(key)) {
      skipped.push({ text: n.text, reason: 'already in the list' })
      continue
    }
    if (accepted.length >= capacity) {
      skipped.push({ text: n.text, reason: `limit of ${max} custom questions reached` })
      continue
    }
    seen.add(key)
    accepted.push(n.text)
  }
  if (nonEmpty.length > MAX_LINES_PER_REQUEST) {
    skipped.push({ text: '…', reason: `only the first ${MAX_LINES_PER_REQUEST} lines are read at a time` })
  }
  return { accepted, skipped }
}

export interface CustomQuestion {
  id: string
  text: string
}

export interface AddResult {
  added: number
  skipped: AddPlan['skipped']
  questions: CustomQuestion[]
}

export const MAX_LINE_LENGTH = 500 // raw input per line, before cleanup
