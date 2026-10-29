import type { ButtonHTMLAttributes, ReactNode } from 'react'

const COLORS = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500']

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' }) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${COLORS[Math.abs(hash) % COLORS.length]} ${size === 'sm' ? 'h-8 w-8 text-sm' : 'h-11 w-11 text-lg'}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`pop rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur ${className}`}>{children}</div>
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow-lg shadow-fuchsia-900/30',
    secondary: 'border border-white/20 bg-white/10 text-white',
    danger: 'border border-rose-400/40 text-rose-300',
  }[variant]
  return (
    <button
      {...props}
      className={`min-h-12 w-full rounded-2xl px-5 py-3 text-base font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${styles} ${className}`}
    />
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="rounded-xl bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
      {children}
    </p>
  ) : null
}

export const inputClass =
  'min-h-12 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-lg text-white placeholder-white/40 focus-visible:outline-2 focus-visible:outline-white'
