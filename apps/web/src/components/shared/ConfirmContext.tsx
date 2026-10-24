import React, { createContext, useContext, useState, useCallback } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { toast } from 'sonner'

export interface ConfirmOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
  successMessage?: string
  cancelMessage?: string | null
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)
  const [isPending, setIsPending] = useState(false)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        open: true,
        options,
        resolve,
      })
    })
  }, [])

  const handleClose = () => {
    if (modalState) {
      modalState.resolve(false)
      const cancelMsg =
        modalState.options.cancelMessage === undefined
          ? 'Suppression annulée'
          : modalState.options.cancelMessage
      if (cancelMsg) {
        toast.info(cancelMsg)
      }
      setModalState(null)
    }
  }

  const handleConfirm = () => {
    if (modalState) {
      modalState.resolve(true)
      if (modalState.options.successMessage) {
        toast.success(modalState.options.successMessage)
      }
      setModalState(null)
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalState && (
        <ConfirmModal
          open={modalState.open}
          title={modalState.options.title || 'Confirmer la suppression'}
          description={
            modalState.options.description ||
            'Voulez-vous vraiment supprimer cet élément ? Cette action est irréversible et supprimera le contenu définitivement.'
          }
          confirmText={modalState.options.confirmText || 'Oui, supprimer'}
          cancelText={modalState.options.cancelText || 'Non, annuler'}
          variant={modalState.options.variant || 'danger'}
          isPending={isPending}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}
