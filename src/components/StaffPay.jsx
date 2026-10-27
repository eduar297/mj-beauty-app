import { Icon } from './ui.jsx';
import { fmtMoney, fmtCup } from '../lib/money';
import { tierInfo } from '../lib/finance';

// Una línea del desglose: qué servicio, cuánto se cobró por él, qué % le toca
// según su nivel de costo, y cuánto deja. En móvil el nombre se queda sin
// sitio, así que ocupa su propia línea.
export function SplitRow({ name, count, amount, tier, pctValue, value, color }) {
  const t = tierInfo(tier);
  return (
    <div className="flex flex-wrap items-center gap-x-2 px-3 py-2 border-b border-border last:border-0 text-[11px]">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
      <span className="min-w-0 basis-[calc(100%-1rem)] sm:basis-0 sm:flex-1">
        {name}{count > 1 && <span className="text-text-muted"> ×{count}</span>}
      </span>
      <span className="text-text-muted whitespace-nowrap ml-3.5 sm:ml-0">
        {fmtMoney(amount)} × {pctValue}% ({t.short})
      </span>
      <strong className="ml-auto text-right flex-shrink-0" style={{ color }}>{fmtMoney(value)}</strong>
    </div>
  );
}

export function SplitTotal({ label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-bg-card text-[11px] font-semibold">
      <span className="flex-1">{label}</span>
      <strong style={{ color }}>{fmtMoney(value)}</strong>
    </div>
  );
}

// Lo que hay que pagarle a cada trabajadora por lo cobrado en el período que
// se esté viendo. Lo usan la Caja (un día, que es como se paga) y Finanzas
// (el mes), con el mismo cálculo.
export default function StaffPay({ fin, tiers, rate = 0, owners = new Set() }) {
  const rows = [...fin.byStaff.values()].sort((a, b) => b.trabajadora - a.trabajadora);
  if (!rows.length) return null;

  return (
    <div className="divide-y divide-border">
      {rows.map(s => (
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
              <div className="text-[11px] text-text-muted">
                {s.count} cobro{s.count === 1 ? '' : 's'} · {fmtMoney(s.total)} vendido · ver desglose
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-sm" style={{ color: '#6db86d' }}>{fmtMoney(s.trabajadora)}</div>
              {fmtCup(s.trabajadora, rate) && <div className="text-[10px] text-text-muted">{fmtCup(s.trabajadora, rate)}</div>}
            </div>
          </summary>

          <div className="mt-2 ml-6 rounded-lg border border-border bg-bg-elevated overflow-hidden">
            {[...s.byService.values()].sort((a, b) => b.trabajadora - a.trabajadora).map(d => (
              <SplitRow key={d.name} name={d.name} count={d.count} amount={d.amount}
                tier={d.tier} pctValue={Number(tiers?.[d.tier || 'medio']?.trabajadora) || 0}
                value={d.trabajadora} color="#6db86d" />
            ))}
            <SplitTotal label="Total a pagarle" value={s.trabajadora} color="#6db86d" />
          </div>
        </details>
      ))}
    </div>
  );
}
