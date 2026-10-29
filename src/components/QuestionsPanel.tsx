import { useEffect, useMemo, useState } from 'react'
import { backend } from '../lib/backend.ts'
import { MAX_CUSTOM_QUESTIONS, MAX_LENGTH, MIN_LENGTH, normalizeQuestion } from '../games/most-likely-to/questionFormat.ts'
import type { AddResult, CustomQuestion } from '../games/most-likely-to/questionFormat.ts'
import { Button, Card, ErrorText, inputClass } from './ui.tsx'

const EXAMPLES = ['get lost in their own neighbourhood', 'laugh at their own joke before the punchline', 'adopt ten cats']

function buildPrompt(theme: string, count: number) {
  return `Write ${count} fun party-game prompts for "Most Likely To", themed around: ${theme.trim() || 'a group of close friends'}.

Each prompt finishes the sentence "Who is most likely to ___?", so write ONLY the ending.

Rules:
- One prompt per line, plain text only
- No numbering, bullets, quotes or blank lines
- Do not include the words "Who is most likely to"
- ${MIN_LENGTH} to ${MAX_LENGTH} characters each
- Start in lowercase and don't end with a question mark
- Keep it playful: nothing cruel, hateful or too personal

Example lines:
${EXAMPLES.slice(0, 2).join('\n')}`
}

export default function QuestionsPanel({ code }: { code: string }) {
  const [custom, setCustom] = useState<CustomQuestion[] | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<AddResult | null>(null)
  const [theme, setTheme] = useState('')
  const [count, setCount] = useState(15)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    backend.listQuestions(code).then((q) => live && setCustom(q)).catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [code])

  const lines = useMemo(
    () => draft.split('\n').map((l) => l.trim()).filter(Boolean).map((raw) => ({ raw, n: normalizeQuestion(raw) })),
    [draft],
  )
  const validCount = lines.filter((l) => l.n.ok).length
  const full = (custom?.length ?? 0) >= MAX_CUSTOM_QUESTIONS

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const add = () =>
    run(async () => {
      const result = await backend.addQuestions(code, draft.split('\n'))
      setCustom(result.questions)
      setNotice(result)
      setDraft('')
    })

  const remove = (id: string) =>
    run(async () => {
      setCustom(await backend.removeQuestion(code, id))
      setNotice(null)
    })

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildPrompt(theme, count))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable: the prompt is still selectable on screen */
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">Add your own questions</h2>
        <p className="text-sm text-white/60">
          They’re mixed in with the built-in ones, or used on their own if you pick “Mine only”.
        </p>
      </div>

      <details className="rounded-xl bg-white/5 p-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">How to write a question (format guide)</summary>
        <div className="space-y-3 pt-2 text-white/80">
          <p>
            Each question finishes the sentence <strong>“Who is most likely to ___?”</strong> Write only the ending, one per line.
          </p>
          <div>
            <p className="font-medium text-emerald-300">✓ Good</p>
            <ul className="ml-5 list-disc">
              {EXAMPLES.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-medium text-rose-300">✗ Avoid</p>
            <ul className="ml-5 list-disc">
              <li>“Who is most likely to get lost?” (we’ll trim the start for you)</li>
              <li>Numbers or bullets, like “1. get lost” (also trimmed)</li>
              <li>Very short or very long lines ({MIN_LENGTH}–{MAX_LENGTH} characters only)</li>
              <li>Anything with &lt; or &gt;</li>
            </ul>
          </div>
          <ul className="ml-5 list-disc">
            <li>Paste many at once: one per line.</li>
            <li>Duplicates are skipped. Up to {MAX_CUSTOM_QUESTIONS} custom questions per room.</li>
            <li>Pick things your whole group can be judged on, and keep it kind.</li>
          </ul>

          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            <p className="font-medium">Let an AI write them for you</p>
            <p>Pick a theme, copy the prompt, paste it into any AI chat, then paste the answer below.</p>
            <input className={inputClass} placeholder="Theme, e.g. college roommates" maxLength={60} value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme" />
            <label className="flex items-center justify-between gap-3">
              <span>How many</span>
              <select className="min-h-11 rounded-xl border border-white/20 bg-slate-800 px-3" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs">{buildPrompt(theme, count)}</pre>
            <Button variant="secondary" onClick={copyPrompt}>{copied ? 'Copied ✓' : 'Copy AI prompt'}</Button>
          </div>
        </div>
      </details>

      <label className="block">
        <span className="sr-only">Questions, one per line</span>
        <textarea
          className={`${inputClass} min-h-28 text-base`}
          placeholder={'get lost in their own neighbourhood\nadopt ten cats'}
          value={draft}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>

      {lines.length > 0 && (
        <ul className="space-y-1 text-sm" aria-label="Preview">
          {lines.slice(0, 50).map((l, i) => (
            <li key={i} className={l.n.ok ? 'text-white' : 'text-rose-300'}>
              {l.n.ok ? <>✓ Who is most likely to <strong>{l.n.text}</strong>?</> : <>✗ “{l.raw.slice(0, 40)}”: {l.n.reason}</>}
            </li>
          ))}
        </ul>
      )}

      <Button disabled={busy || validCount === 0 || full} onClick={add}>
        {busy ? 'Saving…' : validCount > 0 ? `Add ${validCount} question${validCount === 1 ? '' : 's'}` : 'Add questions'}
      </Button>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm">
          Added {notice.added}.
          {notice.skipped.length > 0 && (
            <span className="block text-amber-200">
              Skipped {notice.skipped.length}: {notice.skipped.map((s) => `“${s.text}” (${s.reason})`).join('; ')}
            </span>
          )}
        </p>
      )}
      <ErrorText>{error}</ErrorText>

      {custom && custom.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Your questions ({custom.length}/{MAX_CUSTOM_QUESTIONS})
          </h3>
          <ul className="space-y-2">
            {custom.map((q) => (
              <li key={q.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2 pl-3">
                <span className="min-w-0 flex-1 break-words text-sm">{q.text}</span>
                <button aria-label={`Remove “${q.text}”`} disabled={busy} className="min-h-11 min-w-11 rounded-lg text-rose-300 disabled:opacity-40" onClick={() => remove(q.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
