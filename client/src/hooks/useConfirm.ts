/**
 * useConfirm.ts
 * Hook de confirmation — remplace window.confirm() avec une UI personnalisée.
 *
 * Usage:
 *   const { confirm, ConfirmModalComponent } = useConfirm()
 *   // Dans le JSX : {ConfirmModalComponent}
 *   // Dans un handler :
 *   const ok = await confirm({ title: '...', message: '...' })
 *   if (ok) { ... }
 */

import { useState, useCallback, createElement } from 'react'
import ConfirmModal from '../components/ui/ConfirmModal'

interface ConfirmOptions {
  title:         string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:      'danger' | 'warning' | 'info'
}

interface ConfirmState {
  isOpen:  boolean
  options: ConfirmOptions
  resolve: (val: boolean) => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ isOpen: true, options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setState(prev => { prev?.resolve(true); return null })
  }, [])

  const handleCancel = useCallback(() => {
    setState(prev => { prev?.resolve(false); return null })
  }, [])

  const ConfirmModalComponent = state
    ? createElement(ConfirmModal, {
        isOpen:       state.isOpen,
        title:        state.options.title,
        message:      state.options.message,
        confirmLabel: state.options.confirmLabel,
        cancelLabel:  state.options.cancelLabel,
        variant:      state.options.variant,
        onConfirm:    handleConfirm,
        onCancel:     handleCancel,
      })
    : null

  return { confirm, ConfirmModalComponent }
}
