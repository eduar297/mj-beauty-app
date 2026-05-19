import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { Icon, Avatar, ListLoading } from '../components/ui.jsx';
import { api_staff } from '../lib/api';

export default function Login() {
  const [step, setStep] = useState('select'); // 'select' | 'pin'
  const [staffList, setStaffList] = useState(null); // null = loading
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { loginWithPin, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => { if (user) nav('/dashboard'); }, [user, nav]);

  useEffect(() => {
    api_staff.listForLogin().then(({ data }) => setStaffList(data || []));
  }, []);

  const pickStaff = (s) => {
    setSelected(s);
    setPin('');
    setError('');
    setStep('pin');
  };

  const back = () => {
    setStep('select');
    setSelected(null);
    setPin('');
    setError('');
  };

  const tryLogin = async (full) => {
    try {
      setVerifying(true);
      await loginWithPin(selected.id, full);
      nav('/dashboard');
    } catch (e) {
      setError('PIN incorrecto');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  const handleKey = async (k) => {
    setError('');
    if (k === 'del') return setPin(p => p.slice(0, -1));
    if (k === 'clr') return setPin('');
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length >= 4) tryLogin(next);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-bg p-4 relative overflow-hidden">
      {/* <img src="/assets/hero-bg.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-10" /> */}

      <div className="relative z-10 w-full max-w-md bg-bg-card border border-border-strong rounded-3xl p-7 shadow-2xl fade-up">
        <div className="text-center mb-6">
          <img src="/assets/logo.jpeg" alt="MJ Beauty" className="w-14 h-14 mx-auto mb-3 rounded-full object-cover border border-gold/30" />
          {step === 'select' ? (
            <>
              <h1 className="font-serif text-2xl font-semibold">¿Quién eres?</h1>
              <p className="text-xs text-text-muted mt-1">Selecciona tu perfil para continuar</p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-2xl font-semibold">Hola, {selected?.name?.split(' ')[0]}</h1>
              <p className="text-xs text-text-muted mt-1">Ingresa tu PIN para entrar</p>
            </>
          )}
        </div>

        {step === 'select' && (
          <>
            {staffList === null ? (
              <ListLoading label="Cargando equipo…" />
            ) : staffList.length === 0 ? (
              <div className="text-center py-8 text-sm text-text-muted">
                No hay empleadas activas. Pide al administrador que cree tu perfil.
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-3 max-h-[55vh] overflow-y-auto py-1 px-1">
                {staffList.map(s => (
                  <button
                    key={s.id}
                    onClick={() => pickStaff(s)}
                    aria-label={`Iniciar sesión como ${s.name}`}
                    className="w-[140px] bg-bg-elevated border border-border rounded-2xl pt-5 pb-4 px-3 flex flex-col items-center gap-2 hover:border-gold/60 hover:-translate-y-0.5 motion-reduce:transform-none transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                  >
                    <Avatar
                      initials={s.initials || s.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      color={s.color || 'var(--gold)'}
                      size={52}
                    />
                    <div className="text-sm font-semibold text-center leading-tight break-words w-full" title={s.name}>{s.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-text-muted">{s.role}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'pin' && (
          <>
            <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl p-3 mb-5">
              <Avatar
                initials={selected.initials || selected.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                color={selected.color || 'var(--gold)'}
                size={40}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{selected.name}</div>
                <div className="text-[11px] uppercase tracking-widest text-text-muted">{selected.role}</div>
              </div>
              <button onClick={back} className="text-xs text-text-muted hover:text-gold cursor-pointer">Cambiar</button>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i}
                  style={{
                    borderColor: i < pin.length ? 'var(--gold)' : 'var(--border-strong)',
                    background: i < pin.length ? 'var(--gold)' : 'transparent',
                  }}
                  className="w-3 h-3 rounded-full border transition" />
              ))}
            </div>

            <div className="h-5 text-center mb-2">
              {error && <span className="text-red-400 text-sm">{error}</span>}
              {verifying && <span className="text-gold text-sm inline-flex items-center gap-2"><Icon name="clock" size={12} /> Verificando…</span>}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {['1','2','3','4','5','6','7','8','9','clr','0','del'].map(k => {
                const isDigit = /^\d$/.test(k);
                return (
                  <button
                    key={k}
                    onClick={() => handleKey(k)}
                    disabled={verifying}
                    aria-label={k === 'clr' ? 'Limpiar' : k === 'del' ? 'Borrar último dígito' : `Dígito ${k}`}
                    className={`h-14 rounded-2xl font-serif text-2xl border transition active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40 cursor-pointer ${
                      isDigit
                        ? 'bg-bg-elevated border-border hover:border-gold text-text'
                        : 'bg-transparent border-border text-text-muted hover:text-gold'
                    }`}>
                    {k === 'clr' ? <span className="text-xs">Limpiar</span> : k === 'del' ? '⌫' : k}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button onClick={() => nav('/')} className="block mx-auto mt-6 text-xs text-text-muted hover:text-gold cursor-pointer">
          ← Volver al sitio
        </button>
      </div>
    </div>
  );
}
