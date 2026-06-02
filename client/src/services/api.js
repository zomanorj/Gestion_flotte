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
    if (error.response?.status === 401) {
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

export default api;
