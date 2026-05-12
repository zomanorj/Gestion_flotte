// Page de connexion — accès public
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const [form,       setForm]       = useState({ email: '', password: '' });
  const [erreur,     setErreur]     = useState('');
  const [chargement, setChargement] = useState(false);

  /** Met à jour le champ du formulaire modifié */
  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErreur('');
  };

  /** Soumet le formulaire et redirige si succès */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setErreur('Veuillez remplir tous les champs');
      return;
    }
    setChargement(true);
    const result = await login(form.email, form.password);
    setChargement(false);
    if (result.success) {
      navigate('/');
    } else {
      setErreur(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 p-4">
      <div className="w-full max-w-md">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🚗</div>
          <h1 className="text-3xl font-bold text-white">FlotteApp</h1>
          <p className="text-blue-200 mt-2">Gestion de Flotte — Madagascar</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="admin@flotte.mg"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-shadow"
                autoComplete="email"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-shadow"
                autoComplete="current-password"
              />
            </div>

            {/* Message d'erreur */}
            {erreur && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200
                              text-sm px-4 py-3 rounded-xl">
                <span>⚠️</span>
                <span>{erreur}</span>
              </div>
            )}

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={chargement}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl
                         hover:bg-blue-700 active:scale-95 transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {chargement ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Connexion en cours…
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Comptes de démonstration */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-2">Comptes de démonstration :</p>
            <p>📧 admin@flotte.mg</p>
            <p>📧 gestionnaire@flotte.mg</p>
            <p>📧 chauffeur@flotte.mg</p>
            <p className="mt-1">🔑 Mot de passe : <span className="font-mono">password123</span></p>
          </div>
        </div>

        <p className="text-center text-blue-200 text-sm mt-6">
          Projet portfolio — L3 Informatique — Antananarivo
        </p>
      </div>
    </div>
  );
}
