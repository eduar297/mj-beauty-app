import { createContext, useContext, useEffect, useState } from 'react';
import { api_settings } from '../lib/api';
import { fmtMoney, fmtCup, fmtDual } from '../lib/money';

// Contexto de la tasa de cambio USD → CUP.
// Se carga una sola vez desde site_settings (lectura pública) y queda
// disponible en toda la app para mostrar precios en dólares y su
// equivalente en pesos cubanos. La Caja puede actualizar la tasa en vivo
// con setRate() para que todo se refresque sin recargar.
const FxContext = createContext({
  rate: 0,
  source: 'auto',
  updatedAt: null,
  ready: false,
  setRate: () => {},
  setSource: () => {},
  fmtDual: (usd) => fmtMoney(usd),
  fmtCup: () => '',
});

export function FxProvider({ children }) {
  const [rate, setRate] = useState(0);
  // 'auto' = la trae sola el cron desde la API pública; 'manual' = la fijó
  // la administradora desde la Caja (y el cron no la pisa).
  const [source, setSource] = useState('auto');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api_settings.get().then(({ data }) => {
      setRate(Number(data?.usd_to_cup) || 0);
      setSource(data?.fx_source || 'auto');
      setUpdatedAt(data?.fx_updated_at || null);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const value = {
    rate,
    source,
    updatedAt,
    ready,
    setRate,
    setSource,
    fmtDual: (usd) => fmtDual(usd, rate),
    fmtCup: (usd) => fmtCup(usd, rate),
  };

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export const useFx = () => useContext(FxContext);
