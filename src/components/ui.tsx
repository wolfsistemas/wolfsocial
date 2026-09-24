import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-white/10 bg-white/[0.03] p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  )
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-violet-600 text-white hover:bg-violet-500',
        variant === 'ghost' &&
          'border border-white/15 bg-transparent text-slate-200 hover:bg-white/5',
        variant === 'danger' &&
          'border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20',
        className,
      )}
    />
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

const controlClass =
  'w-full rounded-lg border border-white/15 bg-[#0d1119] px-3 py-2 text-base text-slate-100 outline-none transition focus:border-violet-500 sm:text-sm'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(controlClass, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={clsx(controlClass, props.className)} />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(controlClass, props.className)} />
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-slate-500">{description}</p>
      ) : null}
      {action}
    </div>
  )
}

const statusStyles: Record<string, string> = {
  connected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  scheduled: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  publishing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  draft: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
  canceled: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  expired: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  revoked: 'bg-red-500/15 text-red-300 border-red-500/30',
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  queued: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  sending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status] ?? statusStyles.draft,
      )}
    >
      {label ?? status}
    </span>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#10141d] p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {children}
    </p>
  )
}
