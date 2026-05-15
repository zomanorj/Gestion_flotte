/**
 * ConfirmModal.tsx
 * Modal de confirmation personnalisé — remplace window.confirm().
 */

interface ConfirmModalProps {
  isOpen:        boolean
  title:         string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:      'danger' | 'warning' | 'info'
  onConfirm:     () => void
  onCancel:      () => void
}

const VARIANT_STYLES = {
  danger:  { icon: 'text-red-600',    bg: 'bg-red-100',    btn: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: 'text-orange-600', bg: 'bg-orange-100', btn: 'bg-orange-600 hover:bg-orange-700' },
  info:    { icon: 'text-blue-600',   bg: 'bg-blue-100',   btn: 'bg-blue-600 hover:bg-blue-700' },
}

export default function ConfirmModal({
  isOpen, title, message,
  confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  variant = 'danger', onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  const s = VARIANT_STYLES[variant]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">

        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${s.bg}`}>
            {variant === 'danger' || variant === 'warning' ? (
              <svg className={`w-5 h-5 ${s.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className={`w-5 h-5 ${s.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${s.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
