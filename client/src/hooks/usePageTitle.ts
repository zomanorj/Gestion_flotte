/* Hook pour mettre à jour le titre de l'onglet navigateur — TransiFlow (audit UX). */
import { useEffect } from 'react'

/** @param titre Libellé de la vue (suffixé automatiquement par « — TransiFlow »). */
export function usePageTitle(titre: string) {
  useEffect(() => {
    document.title = `${titre} — TransiFlow`
    // Restaurer au démontage
    return () => {
      document.title = 'TransiFlow'
    }
  }, [titre])
}
