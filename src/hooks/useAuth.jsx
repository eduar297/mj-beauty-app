import { createContext, useContext, useEffect, useState } from 'react';
import { api_staff } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión desde localStorage
    const saved = localStorage.getItem('mj-user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  const loginWithPin = async (pin) => {
    const { data, error } = await api_staff.byPin(pin);
    if (error) throw error;
    if (!data) throw new Error('PIN incorrecto');
    setUser(data);
    localStorage.setItem('mj-user', JSON.stringify(data));
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mj-user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
