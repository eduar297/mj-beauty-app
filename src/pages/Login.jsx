import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { Icon } from '../components/ui.jsx';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithPin, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => { if (user) nav('/dashboard'); }, [user, nav]);

  const handleKey = async (k) => {
    setError('');
    if (k === 'del') return setPin(p => p.slice(0, -1));
    if (k === 'clr') return setPin('');
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length >= 4) {
      // intenta autologin con 4-6 dígitos
      try {
        setLoading(true);
        await loginWithPin(next);
        nav('/dashboard');
      } catch (e) {
        if (next.length >= 6) { setError('PIN incorrecto'); setPin(''); }
      } finally { setLoading(false); }
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-bg p-4 relative overflow-hidden">
      <img src="/assets/hero-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
      <div className="relative z-10 w-full max-w-sm bg-bg-card border border-border-strong rounded-3xl p-8 shadow-2xl fade-up">
        <div className="text-center mb-7">
          <img src="/assets/logo-light.svg" alt="MJ Beauty" className="w-16 mx-auto mb-4" />
          <h1 className="font-serif text-2xl font-semibold">Ingresa tu PIN</h1>
          <p className="text-xs text-text-muted mt-1">Acceso al panel</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ borderColor: i < pin.length ? 'var(--gold)' : 'var(--border-strong)', background: i < pin.length ? 'var(--gold)' : 'transparent' }}
              className={`w-3 h-3 rounded-full border transition ${i >= 4 ? 'opacity-50' : ''}`} />
          ))}
        </div>

        {error && <div className="text-center text-red-400 text-sm mb-3">{error}</div>}
        {loading && <div className="text-center text-gold text-sm mb-3">Verificando…</div>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1','2','3','4','5','6','7','8','9','clr','0','del'].map(k => {
            const isDigit = /^\d$/.test(k);
            return (
              <button key={k} onClick={() => handleKey(k)}
                className={`h-14 rounded-2xl font-serif text-2xl border transition active:scale-95 ${
                  isDigit
                    ? 'bg-bg-elevated border-border hover:border-gold text-text'
                    : 'bg-transparent border-border text-text-muted hover:text-gold'
                }`}>
                {k === 'clr' ? <span className="text-xs">Limpiar</span> : k === 'del' ? '⌫' : k}
              </button>
            );
          })}
        </div>

        <button onClick={() => nav('/')} className="block mx-auto mt-6 text-xs text-text-muted hover:text-gold">
          ← Volver al sitio
        </button>
      </div>
    </div>
  );
}
