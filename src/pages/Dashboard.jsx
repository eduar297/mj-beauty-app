import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { Icon, Avatar } from '../components/ui.jsx';
import { api_notifications } from '../lib/api';
import Agenda from './dashboard/Agenda.jsx';
import Clientes from './dashboard/Clientes.jsx';
import Servicios from './dashboard/Servicios.jsx';
import Empleadas from './dashboard/Empleadas.jsx';
import Caja from './dashboard/Caja.jsx';
import Configuracion from './dashboard/Configuracion.jsx';

const TABS = [
  { id: 'agenda',        label: 'Agenda',        icon: 'calendar', roles: ['admin','empleada'] },
  { id: 'clientes',      label: 'Clientes',      icon: 'users',    roles: ['admin','empleada'] },
  { id: 'servicios',     label: 'Servicios',     icon: 'scissors', roles: ['admin'] },
  { id: 'empleadas',     label: 'Empleadas',     icon: 'staff',    roles: ['admin'] },
  { id: 'caja',          label: 'Caja',          icon: 'cash',     roles: ['admin'] },
  { id: 'configuracion', label: 'Personalización', icon: 'settings', roles: ['admin'] },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [drawer, setDrawer] = useState(false);
  // Centro de notificaciones por empleada (cargadas + realtime).
  const [notifs, setNotifs] = useState([]); // [{ id, type, title, body, read_at, ... }]
  const [bellOpen, setBellOpen] = useState(false);
  const [toast, setToast] = useState(null); // notif item that just arrived
  const allowed = TABS.filter(t => t.roles.includes(user?.role));
  const unreadCount = notifs.filter(n => !n.read_at).length;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    api_notifications.listForStaff(user.id, 20).then(({ data }) => {
      if (alive) setNotifs(data || []);
    });
    const ch = api_notifications.subscribe(user.id, (payload) => {
      if (payload.eventType !== 'INSERT') return;
      const n = payload.new;
      if (!n) return;
      setNotifs(prev => [n, ...prev].slice(0, 50));
      setToast(n);
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`MJ Beauty · ${n.title}`, {
            body: n.body || '',
            icon: '/assets/logo.jpeg',
          });
        } catch {}
      }
      setTimeout(() => setToast(cur => (cur?.id === n.id ? null : cur)), 10000);
    });
    return () => { alive = false; ch?.unsubscribe?.(); };
  }, [user?.id]);

  const openNotification = async (n) => {
    setBellOpen(false);
    if (!n.read_at) {
      await api_notifications.markRead(n.id);
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
    }
    // Navega a la agenda enfocando la cita específica para que aparezca aunque
    // esté en otra semana / día, y abre el modal automáticamente.
    const path = n.appointment_id
      ? `/dashboard/agenda?focus=${n.appointment_id}`
      : '/dashboard/agenda';
    nav(path);
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await api_notifications.markAllRead(user.id);
    const now = new Date().toISOString();
    setNotifs(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] flex-shrink-0 bg-[var(--sidebar-bg)] border-r border-border">
        <div className="px-6 py-7 border-b border-border flex items-center gap-2.5">
          <img src="/assets/logo.jpeg" alt="" className="w-9 h-9 rounded-full object-cover border border-gold/30" />
          <div>
            <div className="font-serif text-xl font-bold text-gold leading-none">MJ Beauty</div>
            <div className="text-[9px] tracking-widest uppercase text-text-muted mt-1">Panel</div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          {allowed.map(t => (
            <NavLink key={t.id} to={`/dashboard/${t.id}`}
              className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition ${isActive ? 'bg-[var(--sidebar-active)] text-gold border-l-2 border-gold font-semibold' : 'text-text-muted hover:bg-[var(--sidebar-hover)]'}`}>
              <Icon name={t.icon} size={16} /> {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <button onClick={() => nav('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-text-muted hover:bg-[var(--sidebar-hover)]">
            <Icon name="home" size={15} /> Ver sitio web
          </button>
          <button onClick={() => { logout(); nav('/'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-text-muted hover:bg-[var(--sidebar-hover)]">
            <Icon name="logout" size={15} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur md:hidden" onClick={() => setDrawer(false)}>
          <aside className="absolute inset-y-0 left-0 w-64 bg-[var(--sidebar-bg)] border-r border-border slide-in-left flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-6 border-b border-border flex justify-between items-center">
              <div className="font-serif text-lg font-bold text-gold">MJ Beauty</div>
              <button onClick={() => setDrawer(false)} className="text-text-muted"><Icon name="close" size={20} /></button>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-0.5">
              {allowed.map(t => (
                <NavLink key={t.id} to={`/dashboard/${t.id}`} onClick={() => setDrawer(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-[var(--sidebar-active)] text-gold border-l-2 border-gold font-semibold' : 'text-text-secondary'}`}>
                  <Icon name={t.icon} size={18} /> {t.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-border space-y-1">
              <button onClick={() => { setDrawer(false); nav('/'); }} className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm text-text-muted">
                <Icon name="home" size={16} /> Ver sitio web
              </button>
              <button onClick={() => { logout(); nav('/'); }} className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm text-text-muted">
                <Icon name="logout" size={16} /> Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-4 sm:px-7 border-b border-border bg-bg-card">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawer(true)} className="md:hidden text-text-secondary p-1.5"><Icon name="menu" size={20} /></button>
            <div className="hidden sm:block text-xs text-text-muted">Hoy — <span className="text-text-secondary">{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
          </div>
          <div className="flex items-center gap-3 relative">
            {/* Bell de notificaciones */}
            <button onClick={() => setBellOpen(o => !o)}
              aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
              className="relative p-1.5 rounded-full hover:bg-bg-hover transition cursor-pointer">
              <Icon name="bell" size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {bellOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
                <div role="menu" className="absolute right-0 top-full mt-2 w-80 bg-bg-elevated border border-border rounded-2xl shadow-2xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                    <div className="text-sm font-semibold">Notificaciones</div>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-gold hover:underline cursor-pointer">
                        Marcar todas leídas
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="text-center text-text-muted text-xs py-8">Sin notificaciones</div>
                    ) : notifs.map(n => (
                      <button key={n.id} onClick={() => openNotification(n)}
                        className={`w-full text-left px-4 py-2.5 border-b border-border last:border-0 hover:bg-bg-hover transition cursor-pointer ${!n.read_at ? 'bg-gold/5' : ''}`}>
                        <div className="flex items-start gap-2">
                          {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs ${!n.read_at ? 'font-semibold' : 'text-text-secondary'}`}>{n.title}</div>
                            {n.body && <div className="text-[11px] text-text-muted truncate mt-0.5">{n.body}</div>}
                            <div className="text-[10px] text-text-muted mt-0.5">
                              {new Date(n.created_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-dim border border-border-strong">
              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
              <span className="text-[11px] text-gold font-semibold capitalize">{user?.role}</span>
            </div>
            <Avatar initials={user?.initials || user?.name?.[0] || '?'} color={user?.color} size={30} photoUrl={user?.photo_url} alt={user?.name} />
            <div className="hidden md:block text-xs text-text-secondary font-medium">{user?.name}</div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-7 pb-24 md:pb-7">
          <Routes>
            <Route index element={<Agenda />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="servicios" element={<Servicios />} />
            <Route path="empleadas" element={<Empleadas />} />
            <Route path="caja" element={<Caja />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Routes>
        </main>

        {toast && (
          <div role="status" aria-live="polite" className="fixed top-4 right-4 z-[300] bg-bg-elevated border-2 border-gold rounded-2xl shadow-2xl p-4 max-w-sm fade-up">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg grid place-items-center bg-gold-dim text-gold border border-border-strong flex-shrink-0">
                <Icon name="bell" size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{toast.title}</div>
                {toast.body && <div className="text-xs text-text-muted mt-0.5 truncate">{toast.body}</div>}
                <div className="flex gap-3 mt-2">
                  <button onClick={() => { setToast(null); openNotification(toast); }} className="text-xs text-gold font-semibold cursor-pointer hover:underline">Ver agenda →</button>
                  <button onClick={() => setToast(null)} className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--sidebar-bg)] border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-around py-1.5">
            {allowed.slice(0,5).map(t => (
              <NavLink key={t.id} to={`/dashboard/${t.id}`}
                className={({isActive}) => `flex flex-col items-center gap-0.5 px-3 py-1.5 ${isActive ? 'text-gold' : 'text-text-muted'}`}>
                {({ isActive }) => (
                  <>
                    <Icon name={t.icon} size={20} color={isActive ? 'var(--gold)' : 'var(--text-muted)'} />
                    <span className={`text-[10px] ${isActive ? 'font-bold' : ''}`}>{t.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function Header({ title, subtitle, action }) {
  return (
    <div className="flex justify-between items-start mb-5 gap-3 flex-wrap">
      <div className="min-w-0">
        <h1 className="font-serif font-semibold leading-tight" style={{ fontSize: 'clamp(20px,4vw,26px)' }}>{title}</h1>
        {subtitle && <p className="text-text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
