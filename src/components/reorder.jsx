import { Icon } from './ui.jsx';
import {
  PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Piezas compartidas del modo "Reordenar" de Servicios y Productos.
//
// Dos reglas que hacen que esto funcione bien con listas largas:
//  1. SOLO la manija arrastra (y solo ella lleva touch-none). Si la tarjeta
//     entera fuera la manija, en el móvil el dedo nunca podría hacer scroll:
//     la grilla queda tapada de tarjetas y no habría dónde tocar para deslizar.
//  2. Además del arrastre hay botones (inicio / ← / →). Llevar una tarjeta del
//     final al principio con arrastre obliga a cruzar todo el scroll esperando
//     el auto-scroll del borde; con un botón es un toque.

export function useReorderSensors() {
  return useSensors(
    // Mouse: pide un desplazamiento mínimo para no romper los clicks.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch: mantener presionado distingue "arrastrar" de "deslizar para scroll".
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

// Auto-scroll más generoso que el de fábrica: el borde sensible es más ancho
// y acelera antes, para que arrastrar hacia arriba en una lista larga no exija
// clavar el cursor en el pixel exacto del borde.
export const AUTO_SCROLL = {
  threshold: { x: 0, y: 0.2 },
  acceleration: 15,
  interval: 5,
};

export function useSortableCard(id) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });
  return {
    setNodeRef,
    isDragging,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 50 : 'auto',
    },
    // Se aplican a la manija, no a la tarjeta (ver regla 1 arriba).
    handleProps: { ...attributes, ...listeners },
  };
}

// Barra superpuesta en la tarjeta durante el modo reordenar:
// manija para arrastrar + atajos para mover sin arrastrar.
export function ReorderControls({ handleProps, index, total, onMove, name }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const stop = (fn) => (e) => { e.stopPropagation(); e.preventDefault(); fn(); };

  const btn = 'w-7 h-7 rounded-full grid place-items-center border shadow-sm transition ' +
    'bg-bg-card/95 border-border-strong text-text-secondary ' +
    'hover:border-gold hover:text-gold cursor-pointer ' +
    'disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:border-border-strong disabled:hover:text-text-secondary';

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 p-2">
      {/* Manija: lo único que arrastra, y lo único con touch-none. */}
      <button type="button" {...handleProps}
        aria-label={`Arrastrar para mover ${name}`}
        className="w-8 h-8 rounded-full bg-gold text-[#0d0c0a] grid place-items-center shadow-md
                   cursor-grab active:cursor-grabbing touch-none select-none flex-shrink-0">
        <Icon name="menu" size={14} color="#0d0c0a" />
      </button>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-text-muted bg-bg-card/95 border border-border-strong
                         rounded-full px-2 py-1 shadow-sm whitespace-nowrap">
          {index + 1}/{total}
        </span>
        <button type="button" className={btn} disabled={isFirst}
          onClick={stop(() => onMove(0))}
          aria-label={`Mover ${name} al inicio`} title="Mover al inicio">
          <Icon name="chevronsLeft" size={13} color="currentColor" />
        </button>
        <button type="button" className={btn} disabled={isFirst}
          onClick={stop(() => onMove(index - 1))}
          aria-label={`Mover ${name} una posición atrás`} title="Mover atrás">
          <Icon name="chevronLeft" size={13} color="currentColor" />
        </button>
        <button type="button" className={btn} disabled={isLast}
          onClick={stop(() => onMove(index + 1))}
          aria-label={`Mover ${name} una posición adelante`} title="Mover adelante">
          <Icon name="chevronRight" size={13} color="currentColor" />
        </button>
      </div>
    </div>
  );
}

// Aviso que explica cómo reordenar (idéntico en ambas páginas).
export function ReorderHint() {
  return (
    <div className="mb-3 text-xs text-text-muted bg-gold/10 border border-gold/30 rounded-lg px-3 py-2">
      Modo reordenar activo — arrastra por la manija <span className="text-gold font-semibold">≡</span>, o usa
      los botones para mover al inicio (
      <span className="text-gold font-semibold">«</span>) y de a un lugar. Fuera de la manija puedes
      desplazar la lista normalmente. Los cambios se guardan solos.
    </div>
  );
}
