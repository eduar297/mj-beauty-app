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
  ready: false,
  setRate: () => {},
  fmtDual: (usd) => fmtMoney(usd),
  fmtCup: () => '',
});

export function FxProvider({ children }) {
  const [rate, setRate] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api_settings.get().then(({ data }) => {
      setRate(Number(data?.usd_to_cup) || 0);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const value = {
    rate,
    ready,
    setRate,
    fmtDual: (usd) => fmtDual(usd, rate),
    fmtCup: (usd) => fmtCup(usd, rate),
  };

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export const useFx = () => useContext(FxContext);
