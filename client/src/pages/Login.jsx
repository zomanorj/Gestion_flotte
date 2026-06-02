import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, AlertTriangle, Mail, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const [form,       setForm]       = useState({ email: '', password: '' });
  const [erreur,     setErreur]     = useState('');
  const [chargement, setChargement] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErreur('');
  };

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
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3"
         style={{ background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8, #2563eb)' }}>
      <div className="w-100" style={{ maxWidth: '26rem' }}>

        {/* Logo */}
        <div className="text-center mb-4">
          <div className="d-inline-flex align-items-center justify-content-center rounded-3 mb-3"
               style={{ width: '80px', height: '80px', backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Car size={40} color="white" />
          </div>
          <h1 className="fw-bold text-white fs-3">FlotteApp</h1>
          <p style={{ color: '#bfdbfe' }}>Gestion de Flotte — Madagascar</p>
        </div>

        {/* Formulaire */}
        <div className="card border-0 shadow-lg rounded-3">
          <div className="card-body p-4">
            <h2 className="fs-5 fw-semibold text-dark mb-4">Connexion</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-medium">Adresse email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="admin@flotte.mg"
                  className="form-control"
                  autoComplete="email"
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-medium">Mot de passe</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="form-control"
                  autoComplete="current-password"
                />
              </div>

              {erreur && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3">
                  <AlertTriangle size={16} className="flex-shrink-0" />
                  <span className="small">{erreur}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={chargement}
                className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
              >
                {chargement ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" />
                    Connexion en cours…
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {/* Comptes démo */}
            <div className="mt-4 p-3 bg-light rounded-3">
              <p className="fw-medium text-dark small mb-2">Comptes de démonstration :</p>
              <div className="d-flex flex-column gap-1 text-muted" style={{ fontSize: '0.8rem' }}>
                <p className="d-flex align-items-center gap-2 mb-0">
                  <Mail size={12} /> admin@flotte.mg
                </p>
                <p className="d-flex align-items-center gap-2 mb-0">
                  <Mail size={12} /> gestionnaire@flotte.mg
                </p>
                <p className="d-flex align-items-center gap-2 mb-0">
                  <Mail size={12} /> chauffeur@flotte.mg
                </p>
                <p className="d-flex align-items-center gap-2 mb-0 mt-1">
                  <KeyRound size={12} />
                  Mot de passe : <span className="font-monospace fw-medium">password123</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-4 small" style={{ color: '#bfdbfe' }}>
          Projet portfolio — L3 Informatique — Antananarivo
        </p>
      </div>
    </div>
  );
}
