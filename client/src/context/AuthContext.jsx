// Contexte d'authentification — gère l'état global de la session utilisateur
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext(null);

/**
 * Fournisseur du contexte d'auth.
 * Persiste la session dans localStorage pour survivre au rechargement.
 */
export const AuthProvider = ({ children }) => {
  const [user,      setUser]      = useState(null);
  const [token,     setToken]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restauration de la session au démarrage de l'application
  useEffect(() => {
    const tokenSauvegarde = localStorage.getItem('token');
    const userSauvegarde  = localStorage.getItem('user');
    if (tokenSauvegarde && userSauvegarde) {
      setToken(tokenSauvegarde);
      setUser(JSON.parse(userSauvegarde));
    }
    setIsLoading(false);
  }, []);

  /**
   * Connecte l'utilisateur : appelle l'API, sauvegarde token + user.
   * @returns {Object} { success, message }
   */
  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Erreur de connexion';
      return { success: false, message };
    }
  };

  /**
   * Déconnecte l'utilisateur et vide le stockage local.
   */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Hook pour accéder au contexte d'authentification */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
};

/**
 * Composant de protection de route.
 * Redirige vers /login si l'utilisateur n'est pas authentifié.
 */
export const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};
