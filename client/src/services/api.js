// Service axios — configuration globale des appels API
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Intercepteur de requête : ajoute le token JWT si présent
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Un 401 sur /auth/login signifie "identifiants incorrects" : on laisse la page l'afficher
    const estLogin = error.config?.url?.endsWith('/auth/login');
    if (error.response?.status === 401 && !estLogin) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 500) {
      window.dispatchEvent(new CustomEvent('api:erreur500'));
    } else if (!error.response) {
      window.dispatchEvent(new CustomEvent('api:reseau'));
    }
    return Promise.reject(error);
  }
);

/**
 * Télécharge un fichier protégé par JWT (PDF, document uploadé…).
 * Un simple <a href> n'envoie pas le token : on passe par axios puis par un lien blob.
 * @param {string} chemin     - Chemin relatif à l'API, ex. "/missions/3/bon-livraison"
 * @param {string} nomFichier - Nom proposé pour l'enregistrement
 */
export const telechargerFichier = async (chemin, nomFichier) => {
  const { data } = await api.get(chemin, { responseType: 'blob' });
  const url  = URL.createObjectURL(data);
  const lien = document.createElement('a');
  lien.href     = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default api;
