/**
 * LoginPage.tsx
 * Page de connexion au système TransiFlow.
 *
 * Design : carte blanche centrée sur fond slate-50, avec logo, formulaire soigné,
 * gestion des états de chargement et d'erreur, et transitions fluides.
 *
 * Après une connexion réussie, l'utilisateur est redirigé vers le tableau de bord.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

// ─────────────────────────────────────────────────────────────────────────────
// Icônes SVG inline (extraites de Heroicons 2.0 — outline)
// ─────────────────────────────────────────────────────────────────────────────

/** Icône camion / transport */
function IconeTransport() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H3m16.5 0h-.375m-16.5 0H3
           m0 0a2.25 2.25 0 01-2.25-2.25V6A2.25 2.25 0 013 3.75h13.5A2.25 2.25 0 0118.75 6v1.5
           M3.75 18.75h9m-9 0v-4.5m0 4.5V9m0-4.5h9M12.75 9h3.375c.621 0 1.125.504 1.125 1.125
           v5.25c0 .621-.504 1.125-1.125 1.125H12.75M3.75 9v4.5m0-4.5H12.75" />
    </svg>
  )
}

/** Icône email (enveloppe) */
function IconeEmail() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75
           m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243
           a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91
           a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

/** Icône cadenas (mot de passe) */
function IconeCadenas() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5
           a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75
           a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

/** Icône œil (afficher mot de passe) */
function IconeOeil({ ouvert }: { ouvert: boolean }) {
  if (ouvert) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5
             c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639
             C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5
           c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5
           c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3
           m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65
           m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

/** Spinner tournant pour l'état de chargement du bouton */
function SpinnerBouton() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

function LoginPage() {
  usePageTitle('Connexion')
  const { login, isAuthenticated, isLoading: isLoadingAuth } = useAuth()
  const navigate = useNavigate()

  // État du formulaire
  const [emailSaisi,          setEmailSaisi]          = useState('')
  const [motDePasseSaisi,     setMotDePasseSaisi]     = useState('')
  const [motDePasseVisible,   setMotDePasseVisible]   = useState(false)
  const [erreurConnexion,     setErreurConnexion]     = useState<string | null>(null)
  const [chargementConnexion, setChargementConnexion] = useState(false)

  // Si l'utilisateur est déjà connecté, rediriger immédiatement
  if (!isLoadingAuth && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  /**
   * handleSoumettreFormulaire
   * Gère la soumission du formulaire de connexion.
   * Appelle login() du contexte, gère les erreurs, puis redirige.
   */
  const handleSoumettreFormulaire = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault()
    setErreurConnexion(null)
    setChargementConnexion(true)

    try {
      await login(emailSaisi, motDePasseSaisi)
      // Connexion réussie : navigation vers le tableau de bord
      navigate('/', { replace: true })
    } catch (erreur: unknown) {
      // Extraction du message d'erreur retourné par l'API
      const messageErreur =
        (erreur as { response?: { data?: { message?: string } } })
          ?.response?.data?.message
        ?? 'Une erreur est survenue, veuillez réessayer'

      setErreurConnexion(messageErreur)
    } finally {
      setChargementConnexion(false)
    }
  }

  return (
    // Fond pleine page en slate-50 avec centrage flexbox
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">

      {/* Carte de connexion */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

        {/* ── Logo & En-tête ── */}
        <div className="flex flex-col items-center mb-8">
          {/* Logo : rond bleu avec icône camion */}
          <div className="w-16 h-16 bg-blue-800 rounded-2xl flex items-center justify-center text-white mb-4 shadow-md">
            <IconeTransport />
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-1">Bienvenue</h1>
          <p className="text-sm text-slate-500 text-center">
            Connectez-vous à votre espace TransiFlow
          </p>
        </div>

        {/* ── Formulaire ── */}
        <form onSubmit={handleSoumettreFormulaire} noValidate className="space-y-5">

          {/* Champ email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Adresse email
            </label>
            <div className="relative">
              {/* Icône à gauche */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconeEmail />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={emailSaisi}
                onChange={(e) => setEmailSaisi(e.target.value)}
                placeholder="nom@transiflow.app"
                className="
                  w-full pl-10 pr-4 py-2.5 text-sm
                  border border-slate-300 rounded-lg
                  text-slate-800 placeholder-slate-400
                  bg-white
                  outline-none
                  transition-all duration-150
                  focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                "
              />
            </div>
          </div>

          {/* Champ mot de passe */}
          <div>
            <label
              htmlFor="motDePasse"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Mot de passe
            </label>
            <div className="relative">
              {/* Icône cadenas à gauche */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconeCadenas />
              </div>
              <input
                id="motDePasse"
                type={motDePasseVisible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={motDePasseSaisi}
                onChange={(e) => setMotDePasseSaisi(e.target.value)}
                placeholder="••••••••"
                className="
                  w-full pl-10 pr-10 py-2.5 text-sm
                  border border-slate-300 rounded-lg
                  text-slate-800 placeholder-slate-400
                  bg-white
                  outline-none
                  transition-all duration-150
                  focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                "
              />
              {/* Bouton afficher/masquer le mot de passe */}
              <button
                type="button"
                onClick={() => setMotDePasseVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-150"
                aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <IconeOeil ouvert={motDePasseVisible} />
              </button>
            </div>
          </div>

          {/* Message d'erreur (visible seulement en cas d'échec) */}
          {erreurConnexion && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {/* Icône d'avertissement */}
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
                     c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z
                     M12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{erreurConnexion}</span>
            </div>
          )}

          {/* Bouton de connexion */}
          <button
            type="submit"
            disabled={chargementConnexion}
            className="
              w-full flex items-center justify-center gap-2
              py-2.5 px-4 rounded-lg text-sm font-semibold
              bg-blue-800 text-white
              hover:bg-blue-900
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            "
          >
            {chargementConnexion ? (
              <>
                <SpinnerBouton />
                <span>Connexion en cours…</span>
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        {/* Pied de carte */}
        <p className="text-center text-xs text-slate-400 mt-6">
          TransiFlow — Système de gestion de flotte
        </p>
      </div>
    </div>
  )
}

export default LoginPage
