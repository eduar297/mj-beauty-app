import { useEffect, useMemo, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, ListLoading } from '../../components/ui.jsx';
import { api_transactions, api_services, api_staff, api_purchases, api_supplies, api_service_supplies } from '../../lib/api';
import { fmtMoney } from '../../lib/money';
import { summarize, perHour, tierInfo } from '../../lib/finance';
import { thisMonth, addMonthsYM, monthBounds, monthLabel } from '../../lib/dates';
import { useFx } from '../../hooks/useFx.jsx';
import { askJev, CONFIDENCE_MIN, pct } from '../../lib/jev';

const cupFmt = (n) => (n > 0 ? `${new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(n)} CUP` : '');

export default function Finanzas() {
  const now = thisMonth();
  const [month, setMonth] = useState(now);
  const [tx, setTx] = useState(null);          // null = cargando
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const fx = useFx();
  const isNow = month === now;

  // Jev: interpreta la pregunta escrita; el número lo pone siempre la caja.
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(null);   // { intent, trabajadora, confidence, nota }
  const [jevErr, setJevErr] = useState('');
  const [pricing, setPricing] = useState(null);
  const [pricingBusy, setPricingBusy] = useState(false);

  useEffect(() => {
    api_services.list().then(({ data }) => setServices(data || []));
    api_staff.list().then(({ data }) => setStaff(data || []));
    api_supplies.list().then(({ data }) => setSupplies(data || []));
    api_service_supplies.all().then(({ data }) => setRecipes(data || []));
  }, []);

  useEffect(() => {
    setTx(null);
    const { from, to } = monthBounds(month);
    api_transactions.listRange(from, to).then(({ data }) => setTx(data || []));
    api_purchases.list({ from, to }).then(({ data }) => setPurchases(data || []));
  }, [month]);

  const fin = useMemo(
    () => summarize(tx || [], services, fx.tiers, fx.rate),
    [tx, services, fx.tiers, fx.rate]);

  // Quién es la dueña: su pago de trabajadora y la ganancia del salón van al
  // mismo bolsillo, y conviene que se vea.
  const owners = useMemo(
    () => new Set(staff.filter(s => s.role === 'admin').map(s => s.name)),
    [staff]);

  const byStaff = useMemo(
    () => [...fin.byStaff.values()].sort((a, b) => b.trabajadora - a.trabajadora),
    [fin]);

  const svc = useMemo(() => [...fin.byService.values()], [fin]);
  const topCount  = useMemo(() => [...svc].sort((a, b) => b.count - a.count).slice(0, 5), [svc]);
  const topProfit = useMemo(() => [...svc].sort((a, b) => b.duena - a.duena).slice(0, 5), [svc]);
  const topHour   = useMemo(
    () => svc.filter(s => s.minutes > 0)
      .sort((a, b) => perHour(b.duena, b.minutes) - perHour(a.duena, a.minutes)).slice(0, 5),
    [svc]);

  const pctMat = fin.total > 0 ? (fin.materiales / fin.total) * 100 : 0;

  // Materiales de verdad: lo que gastó comprando, y lo que dicen las recetas
  // que consumió. Comparado con lo que el porcentaje aparta, es lo que dice
  // si el reparto le alcanza o se está quedando corta.
  const mat = useMemo(() => {
    const cost = new Map(supplies.map(s2 => [s2.id, Number(s2.unit_cost) || 0]));
    const perService = new Map();
    for (const r of recipes) {
      perService.set(r.service_id,
        (perService.get(r.service_id) || 0) + (Number(r.qty) || 0) * (cost.get(r.supply_id) || 0));
    }
    let consumido = 0, conReceta = 0, sinReceta = 0;
    for (const e of fin.byService.values()) {
      if (e.id && perService.has(e.id)) { consumido += perService.get(e.id) * e.count; conReceta += e.count; }
      else sinReceta += e.count;
    }
    return {
      comprado: purchases.reduce((a, p) => a + (Number(p.total_cost) || 0), 0),
      consumido, conReceta, sinReceta,
      hayRecetas: perService.size > 0,
    };
  }, [purchases, supplies, recipes, fin]);
  const best = topProfit[0];
  const worst = [...svc].sort((a, b) => a.duena - b.duena)[0];
  const loading = tx === null;
  const empty = !loading && fin.count === 0;

  // Lista que se le pasa a Jev para que señale un servicio. Son los números
  // ya calculados: Jev decide cuál, no cuánto.
  const pricingPayload = () => ({
    rate: fx.rate,
    period: monthLabel(month),
    total: fin.total,
    services: svc.filter(x => x.name && x.count > 0).map(x => ({
      name: x.name, price: x.total / Math.max(x.count, 1), duration: x.minutes / Math.max(x.count, 1),
      cost_tier: x.tier, duena: x.duena, perHour: perHour(x.duena, x.minutes), count: x.count,
    })),
  });

  const runPricing = async () => {
    setPricingBusy(true); setJevErr(''); setPricing(null);
    try {
      const r = await askJev('pricing', pricingPayload());
      setPricing(r.answers);
    } catch (e) { setJevErr(e.message); }
    finally { setPricingBusy(false); }
  };

  const submitAsk = async (e) => {
    e?.preventDefault();
    const text = ask.trim();
    if (!text) return;
    setAsking(true); setJevErr(''); setAsked(null);
    try {
      const r = await askJev('intent', { text, staff: [...fin.byStaff.keys()] });
      const a = r.answers;
      const periodo = a.periodo?.choice;
      let nota = '';
      // El panel se mueve solo si ella nombró el período. Si no dijo nada,
      // responde sobre el mes que ya tenía abierto.
      if (periodo === 'mes_pasado') setMonth(addMonthsYM(now, -1));
      else if (periodo === 'este_mes') setMonth(now);
      else if (periodo === 'hoy') nota = 'El detalle de hoy está en la Caja; aquí va el mes completo.';
      else if (periodo === 'este_anno') nota = 'Este panel va mes a mes; te respondo del mes abierto.';

      setAsked({
        intent: a.intent?.choice,
        confidence: a.intent?.confidence ?? 0,
        trabajadora: a.trabajadora?.choice,
        nota,
      });
      if (a.intent?.choice === 'subir_precio' && (a.intent?.confidence ?? 0) >= CONFIDENCE_MIN) runPricing();
    } catch (e2) { setJevErr(e2.message); }
    finally { setAsking(false); }
  };

  const answer = asked && asked.confidence >= CONFIDENCE_MIN
    ? answerFor(asked, fin, pctMat) : null;

  return (
    <div>
      <Header title="Finanzas" subtitle={`Resumen de ${monthLabel(month)}`} />

      <div className="mb-4 flex items-center gap-2 flex-wrap bg-bg-card border border-border rounded-xl px-2.5 py-2">
        <button type="button" onClick={() => setMonth(m => addMonthsYM(m, -1))}
          aria-label="Mes anterior"
          className="w-8 h-8 rounded-lg grid place-items-center border border-border-strong text-text-secondary hover:border-gold hover:text-gold cursor-pointer">
          <Icon name="chevronLeft" size={15} />
        </button>
        <input type="month" value={month} max={now} onChange={e => e.target.value && setMonth(e.target.value)}
          aria-label="Ver otro mes"
          className="bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-sm text-text outline-none focus:border-gold appearance-none" />
        <button type="button" onClick={() => setMonth(m => addMonthsYM(m, 1))}
          disabled={isNow} aria-label="Mes siguiente"
          className="w-8 h-8 rounded-lg grid place-items-center border border-border-strong text-text-secondary hover:border-gold hover:text-gold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed">
          <Icon name="chevronRight" size={15} />
        </button>
        {!isNow && (
          <button type="button" onClick={() => setMonth(now)}
            className="text-xs text-gold underline underline-offset-2 cursor-pointer whitespace-nowrap">
            volver a este mes
          </button>
        )}
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Big label="Ventas del mes" usd={fin.total}       cup={fin.cup.total}       color="var(--gold)" icon="cash"  loading={loading} />
        <Big label="Para materiales" usd={fin.materiales} cup={fin.cup.materiales}  color="#64a0d0"     icon="bag"   loading={loading} />
        <Big label="A trabajadoras"  usd={fin.trabajadora} cup={fin.cup.trabajadora} color="#6db86d"    icon="staff" loading={loading} />
        <Big label="Ganancia dueña"  usd={fin.duena}      cup={fin.cup.duena}       color="#d4857a"     icon="star"  loading={loading} />
      </div>

      {loading ? (
        <ListLoading label="Calculando el mes…" />
      ) : empty ? (
        <div className="bg-bg-card border border-border rounded-2xl py-12 text-center text-text-muted text-sm">
          No hubo cobros en {monthLabel(month)}.
        </div>
      ) : (
        <>
          {fin.unclassified > 0 && (
            <p className="text-[11px] text-amber-400 mb-5 -mt-2">
              {fmtMoney(fin.unclassified)} del mes viene de servicios sin nivel de costo asignado;
              se calcularon como "costo medio". Ponles nivel en Servicios para que cuadre exacto.
            </p>
          )}

          <Panel icon="staff" title="Cuánto pagarle a cada trabajadora"
            subtitle={`Su parte de los ${fmtMoney(fin.total)} del mes`}>
            <div className="divide-y divide-border">
              {byStaff.map(s => (
                <details key={s.name} className="py-2.5 group">
                  <summary className="flex items-center gap-3 cursor-pointer list-none">
                    <Icon name="chevronRight" size={13} color="var(--text-muted)" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                        {s.name}
                        {owners.has(s.name) && (
                          <span className="text-[9px] uppercase tracking-wider font-bold text-gold bg-gold-dim border border-gold/40 px-1.5 rounded-full">dueña</span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted">{s.count} cobro{s.count === 1 ? '' : 's'} · {fmtMoney(s.total)} vendido · ver desglose</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm" style={{ color: '#6db86d' }}>{fmtMoney(s.trabajadora)}</div>
                      {cupFmt(s.trabajadora * fx.rate) && <div className="text-[10px] text-text-muted">{cupFmt(s.trabajadora * fx.rate)}</div>}
                    </div>
                  </summary>

                  <div className="mt-2 ml-6 rounded-lg border border-border bg-bg-elevated overflow-hidden">
                    {[...s.byService.values()].sort((a, b) => b.trabajadora - a.trabajadora).map(d => {
                      const t = tierInfo(d.tier);
                      const p = Number(fx.tiers?.[d.tier || 'medio']?.trabajadora) || 0;
                      return (
                        <div key={d.name} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                          <span className="flex-1 min-w-0 truncate">
                            {d.name}{d.count > 1 && <span className="text-text-muted"> ×{d.count}</span>}
                          </span>
                          <span className="text-text-muted whitespace-nowrap">
                            {fmtMoney(d.amount)} × {p}% ({t.short})
                          </span>
                          <strong className="w-14 text-right flex-shrink-0" style={{ color: '#6db86d' }}>{fmtMoney(d.trabajadora)}</strong>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-card text-[11px] font-semibold">
                      <span className="flex-1">Total a pagarle</span>
                      <strong style={{ color: '#6db86d' }}>{fmtMoney(s.trabajadora)}</strong>
                    </div>
                  </div>
                </details>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border">
              Cuando un cobro lleva varios servicios, el monto se reparte entre ellos según
              su precio de lista, y a cada parte se le aplica el % de su nivel de costo.
            </p>
            {[...owners].some(o => fin.byStaff.has(o)) && (
              <p className="text-[11px] text-text-muted mt-1.5">
                Lo marcado como <strong className="text-gold">dueña</strong> es solo su parte de trabajadora.
                La ganancia del salón ({fmtMoney(fin.duena)}) va aparte y también es tuya.
              </p>
            )}
          </Panel>

          <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <Panel icon="star" title="Más realizados" subtitle="Por cantidad de veces">
              <Rank items={topCount} value={(s) => `${s.count}×`} />
            </Panel>
            <Panel icon="cash" title="Más ganancia" subtitle="Lo que te dejó en total">
              <Rank items={topProfit} value={(s) => fmtMoney(s.duena)} />
            </Panel>
            <Panel icon="clock" title="Mejor por hora" subtitle="Ganancia por hora de silla">
              <Rank items={topHour} value={(s) => `${fmtMoney(perHour(s.duena, s.minutes))}/h`} />
            </Panel>
          </div>

          <Panel icon="info" title="Preguntas rápidas" subtitle="Calculado con los cobros del mes" className="mt-4">
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <QA q="¿Cuál fue mi ganancia este mes?" a={fmtMoney(fin.duena)} sub={cupFmt(fin.cup.duena)} />
              <QA q="¿Cuánto tengo para reinversión?" a={fmtMoney(fin.materiales)} sub={cupFmt(fin.cup.materiales)} />
              <QA q="¿Qué % se va en materiales?" a={`${pctMat.toFixed(1)}%`} sub={`de ${fmtMoney(fin.total)} vendidos`} />
              <QA q="¿Qué servicio deja más ganancia?" a={best?.name || '—'} sub={best ? `${fmtMoney(best.duena)} en ${best.count} vez/veces` : ''} />
              <QA q="¿Qué servicio deja menos?" a={worst?.name || '—'} sub={worst ? `${fmtMoney(worst.duena)} en ${worst.count} vez/veces` : ''} />
              <div className="rounded-xl border border-border bg-bg-elevated p-3">
                <div className="text-[11px] text-text-muted leading-snug">¿Qué servicio subir de precio?</div>
                {pricing ? (
                  <>
                    <div className="font-bold mt-1 leading-tight" style={{ fontSize: 'clamp(14px,2.2vw,18px)' }}>
                      {pricing.subir_precio?.choice}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      Jev lo señala con {pct(pricing.subir_precio?.confidence)} de confianza
                      {pricing.urgencia && ` · ${pricing.urgencia.legend?.[Math.round(pricing.urgencia.score)] || ''}`}
                    </div>
                    <button type="button" onClick={runPricing} disabled={pricingBusy}
                      className="text-[10px] text-gold underline underline-offset-2 cursor-pointer mt-1.5 disabled:opacity-50">
                      volver a analizar
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={runPricing} disabled={pricingBusy || !svc.length}
                    className="mt-1.5 text-xs font-semibold text-gold border border-gold/40 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-gold-dim disabled:opacity-50 disabled:cursor-not-allowed">
                    {pricingBusy ? 'Analizando…' : 'Analizar precios'}
                  </button>
                )}
              </div>
            </div>
          </Panel>
        </>
      )}

        {!loading && (fin.count > 0 || purchases.length > 0) && (
          <Panel icon="box" title="Materiales: lo que apartas vs lo que gastas" className="mt-4"
            subtitle="Si gastas más de lo que apartas, el reparto se te queda corto">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <MiniStat label="Apartado" value={fmtMoney(fin.materiales)} sub={`${pctMat.toFixed(1)}% de las ventas`} color="#64a0d0" />
              <MiniStat label="Comprado" value={fmtMoney(mat.comprado)} sub={`${purchases.length} compra(s) este mes`} color="#d4857a" />
              {mat.hayRecetas && (
                <MiniStat label="Consumido" value={fmtMoney(mat.consumido)} sub="según las recetas" color="#8a6f4a" />
              )}
            </div>

            {mat.comprado > 0 && (
              <p className={`text-[11px] mt-3 ${mat.comprado > fin.materiales ? 'text-red-400' : 'text-green-400'}`}>
                {mat.comprado > fin.materiales
                  ? `Compraste ${fmtMoney(mat.comprado - fin.materiales)} más de lo que apartaste. Sube el porcentaje de materiales o revisa los precios.`
                  : `Te sobraron ${fmtMoney(fin.materiales - mat.comprado)} del fondo de materiales.`}
              </p>
            )}
            {mat.comprado === 0 && (
              <p className="text-[11px] text-text-muted mt-3">
                No hay compras registradas en {monthLabel(month)}. Apúntalas en Inventario y aquí verás si el {pctMat.toFixed(0)}% te alcanza.
              </p>
            )}
            {mat.hayRecetas && mat.sinReceta > 0 && (
              <p className="text-[11px] text-amber-400 mt-1.5">
                {mat.sinReceta} de {mat.conReceta + mat.sinReceta} servicios del mes no tienen materiales declarados,
                así que "consumido" se queda corto. Se declaran en cada servicio.
              </p>
            )}
            {!mat.hayRecetas && (
              <p className="text-[11px] text-text-muted mt-1.5">
                Si dices qué insumos usa cada servicio (en Servicios → Materiales que usa),
                aquí sale también lo que consumiste de verdad.
              </p>
            )}
          </Panel>
      )}

      <Panel icon="sparkle" title="Pregúntale a Jev" subtitle="Escríbelo como lo dirías; el número sale de tus cobros" className="mt-4">
          <form onSubmit={submitAsk} className="flex gap-2 flex-wrap">
            <input value={ask} onChange={e => setAsk(e.target.value)}
              placeholder="cuánto le toca a Yani este mes"
              aria-label="Pregúntale a Jev"
              className="flex-1 min-w-[200px] bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold" />
            <button type="submit" disabled={asking || !ask.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gold text-[#0d0c0a] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {asking ? 'Pensando…' : 'Preguntar'}
            </button>
          </form>

          {jevErr && (
            <div role="alert" className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{jevErr}</div>
          )}

          {asked && !answer && (
            <div className="mt-3 text-xs text-amber-400">
              No me quedó claro qué preguntas ({pct(asked.confidence)} de confianza).
              Mira las tarjetas de abajo, ahí están las respuestas.
            </div>
          )}

          {answer && (
            <div className="mt-3 rounded-xl border border-gold/40 bg-gold-dim p-3.5">
              <div className="text-[11px] text-text-muted">{answer.title} · {monthLabel(month)}</div>
              <div className="font-bold leading-tight mt-0.5" style={{ fontSize: 'clamp(18px,3.4vw,26px)' }}>{answer.value}</div>
              {answer.sub && <div className="text-[11px] text-text-muted mt-0.5">{answer.sub}</div>}
              <div className="text-[10px] text-text-muted mt-2 pt-2 border-t border-gold/25">
                Jev entendió la pregunta con {pct(asked.confidence)} de confianza. El número lo calculó la caja.
                {asked.nota && ` ${asked.nota}`}
              </div>
            </div>
          )}
        </Panel>
    </div>
  );
}

// Traduce la intención que entendió Jev a la cifra ya calculada. Nunca sale
// un número del modelo: solo elige qué número mostrar.
function answerFor(asked, fin, pctMat) {
  const svc = [...fin.byService.values()];
  switch (asked.intent) {
    case 'pago_trabajadora': {
      if (asked.trabajadora && asked.trabajadora !== 'todas') {
        const r = fin.byStaff.get(asked.trabajadora);
        return {
          title: `A pagarle a ${asked.trabajadora}`,
          value: fmtMoney(r?.trabajadora || 0),
          sub: r ? `${r.count} cobro${r.count === 1 ? '' : 's'} · ${fmtMoney(r.total)} vendido` : 'No tuvo cobros ese mes',
        };
      }
      return { title: 'A pagar entre todas', value: fmtMoney(fin.trabajadora), sub: `${fin.byStaff.size} persona(s)` };
    }
    case 'ganancia_duena':
      return { title: 'Tu ganancia', value: fmtMoney(fin.duena), sub: `de ${fmtMoney(fin.total)} vendidos` };
    case 'fondo_materiales':
      return { title: 'Guardado para materiales', value: fmtMoney(fin.materiales), sub: `de ${fmtMoney(fin.total)} vendidos` };
    case 'pct_materiales':
      return { title: 'Del ingreso va a materiales', value: `${pctMat.toFixed(1)}%`, sub: `${fmtMoney(fin.materiales)} de ${fmtMoney(fin.total)}` };
    case 'ventas_total':
      return { title: 'Vendido en total', value: fmtMoney(fin.total), sub: `${fin.count} cobros` };
    case 'mas_rentable': {
      const b = [...svc].sort((a, c) => c.duena - a.duena)[0];
      return b ? { title: 'El que más te deja', value: b.name, sub: `${fmtMoney(b.duena)} en ${b.count} vez/veces` } : null;
    }
    case 'menos_rentable': {
      const w = [...svc].sort((a, c) => a.duena - c.duena)[0];
      return w ? { title: 'El que menos te deja', value: w.name, sub: `${fmtMoney(w.duena)} en ${w.count} vez/veces` } : null;
    }
    case 'subir_precio':
      return { title: 'Subir de precio', value: 'Analizando…', sub: 'Mira la tarjeta de abajo' };
    default:
      return null;
  }
}

function Big({ label, usd, cup, color, icon, loading }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 flex gap-3">
      <div className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${color}20` }}>
        <Icon name={icon} size={17} color={color} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold truncate">{label}</div>
        <div className="font-bold leading-tight" style={{ fontSize: 'clamp(16px,3vw,22px)' }}>
          {loading
            ? <span className="inline-block w-20 h-5 bg-bg-hover rounded animate-pulse motion-reduce:animate-none" />
            : fmtMoney(usd)}
        </div>
        {!loading && cupFmt(cup) && <div className="text-[11px] text-text-muted mt-0.5 truncate">{cupFmt(cup)}</div>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color }}>{label}</div>
      <div className="font-bold leading-tight mt-0.5" style={{ fontSize: 'clamp(15px,2.6vw,20px)' }}>{value}</div>
      {sub && <div className="text-[10px] text-text-muted truncate mt-0.5">{sub}</div>}
    </div>
  );
}

function Panel({ icon, title, subtitle, children, className = '' }) {
  return (
    <section className={`bg-bg-card border border-border rounded-2xl p-5 ${className}`}>
      <header className="flex items-center gap-2.5 mb-3 pb-3 border-b border-border">
        <div className="w-9 h-9 rounded-lg grid place-items-center bg-gold-dim text-gold border border-border-strong">
          <Icon name={icon} size={16} />
        </div>
        <div className="min-w-0">
          <h2 className="font-serif text-base font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Rank({ items, value }) {
  if (!items.length) return <div className="text-xs text-text-muted py-2">Sin datos</div>;
  return (
    <ol className="divide-y divide-border">
      {items.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2.5 py-2">
          <span className="w-5 text-[11px] font-bold text-text-muted flex-shrink-0">{i + 1}</span>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.tier ? tierInfo(s.tier).color : 'var(--border-strong)' }} />
          <span className="flex-1 min-w-0 text-sm truncate">{s.name}</span>
          <span className="text-sm font-bold flex-shrink-0">{value(s)}</span>
        </li>
      ))}
    </ol>
  );
}

function QA({ q, a, sub, muted }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-3">
      <div className="text-[11px] text-text-muted leading-snug">{q}</div>
      <div className={`font-bold mt-1 leading-tight ${muted ? 'text-text-muted' : ''}`} style={{ fontSize: 'clamp(14px,2.2vw,18px)' }}>{a}</div>
      {sub && <div className="text-[10px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
