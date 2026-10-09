import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import { clientRequetes } from '../requetes/client';
import { fermerSocket, reconnecterSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,      setUser]      = useState(null);
  const [token,     setToken]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tokenSauvegarde = localStorage.getItem('token');
    const userSauvegarde  = localStorage.getItem('user');
    if (tokenSauvegarde && userSauvegarde) {
      setToken(tokenSauvegarde);
      setUser(JSON.parse(userSauvegarde));
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      // Aucune donnée d'un compte précédent ne doit rester en cache
      clientRequetes.clear();
      fermerSocket();
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

  // Remplace le token courant (ex. renvoyé après un changement de son propre mot de passe)
  const majToken = (nouveauToken) => {
    setToken(nouveauToken);
    localStorage.setItem('token', nouveauToken);
    // L'API a fermé la connexion temps réel liée à l'ancien token
    reconnecterSocket();
  };

  const logout = () => {
    clientRequetes.clear();
    fermerSocket();
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, majToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
};

export const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};
