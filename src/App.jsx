import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import Landing from './pages/Landing.jsx';
import Services from './pages/Services.jsx';
import Galeria from './pages/Galeria.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [user, loading, nav]);
  if (loading) return <div className="h-screen grid place-items-center text-text-muted">Cargando…</div>;
  return user ? children : null;
}

export default function App() {
  useEffect(() => {
    const theme = localStorage.getItem('mj-theme') || 'rose';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/servicios" element={<Services />} />
        <Route path="/servicios/:cat" element={<Services />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
