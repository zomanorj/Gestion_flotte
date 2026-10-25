import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const COMPTES_DEMO = [
  { libelle: 'Administrateur', email: 'admin@flotte.mg' },
  { libelle: 'Gestionnaire',   email: 'gestionnaire@flotte.mg' },
  { libelle: 'Chauffeur',      email: 'chauffeur@flotte.mg' },
];

const ATOUTS = [
  'Missions, planning et disponibilité des camions et des chauffeurs',
  'Documents, maintenances et alertes avant expiration',
  'Carburant, dépenses et paie calculés automatiquement',
];

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const [form,       setForm]       = useState({ email: '', password: '' });
  const [erreur,     setErreur]     = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => { document.title = 'Connexion · TransiFlow'; }, []);

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
      // Un chauffeur arrive directement sur ses missions
      navigate(result.user?.role === 'chauffeur' ? '/mes-missions' : '/');
    } else {
      setErreur(result.message);
    }
  };

  return (
    <div className="connexion">
      {/* Marque (grand écran) */}
      <aside className="connexion-marque">
        <div className="d-flex align-items-center gap-2">
          <span className="d-inline-flex align-items-center justify-content-center rounded-2 bg-white text-dark"
                style={{ width: 34, height: 34 }}>
            <Truck size={18} />
          </span>
          <span className="fw-semibold fs-6">TransiFlow</span>
        </div>
        <div>
          <p className="connexion-accroche mb-4">La gestion de votre flotte de transport, au même endroit.</p>
          <ul className="list-unstyled connexion-points mb-0">
            {ATOUTS.map((a) => <li key={a}><Check size={16} /> {a}</li>)}
          </ul>
        </div>
        <p className="small mb-0" style={{ color: '#adb5bd' }}>Transport routier — Madagascar</p>
      </aside>

      {/* Formulaire */}
      <main className="connexion-formulaire">
        <div className="connexion-boite entree-page">
          <div className="d-flex d-lg-none align-items-center gap-2 mb-4">
            <span className="d-inline-flex align-items-center justify-content-center rounded-2 bg-dark text-white"
                  style={{ width: 32, height: 32 }}>
              <Truck size={17} />
            </span>
            <span className="fw-semibold">TransiFlow</span>
          </div>

          <h1 className="titre-page mb-1" style={{ fontSize: '1.5rem' }}>Connexion</h1>
          <p className="text-muted mb-4">Accédez à votre espace de gestion.</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Adresse e-mail</label>
              <input id="email" type="email" name="email" value={form.email} onChange={handleChange}
                     className="form-control" placeholder="nom@entreprise.mg" autoComplete="email" autoFocus />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Mot de passe</label>
              <input id="password" type="password" name="password" value={form.password} onChange={handleChange}
                     className="form-control" autoComplete="current-password" />
            </div>

            {erreur && (
              <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small apparition" role="alert">
                <AlertTriangle size={16} className="flex-shrink-0" /> {erreur}
              </div>
            )}

            <button type="submit" disabled={chargement} className="btn btn-primary w-100 mt-1" style={{ height: 40 }}>
              {chargement ? (
                <><span className="spinner-border spinner-border-sm" role="status" /> Connexion…</>
              ) : 'Se connecter'}
            </button>
          </form>

          {/* Comptes de démonstration : un clic remplit le formulaire */}
          <div className="mt-4 pt-4 border-top">
            <p className="small text-muted mb-2">Comptes de démonstration (mot de passe <span className="font-monospace">password123</span>)</p>
            <div className="d-flex flex-wrap gap-2">
              {COMPTES_DEMO.map((c) => (
                <button key={c.email} type="button" className="btn btn-outline-secondary btn-sm"
                        onClick={() => { setForm({ email: c.email, password: 'password123' }); setErreur(''); }}>
                  {c.libelle}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
