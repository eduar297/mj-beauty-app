import { useEffect, useRef, useState } from 'react';
import { Icon, Btn, Modal } from './ui.jsx';

// Aspect ratios estándar usados en la app
export const ASPECT_LANDING_CARD = 16 / 9; // tarjeta de servicio (landing + /servicios)
export const ASPECT_SQUARE = 1;            // avatar / foto de perfil

/**
 * Editor de foto pre-upload: pan + zoom dentro de un viewport con el aspect ratio
 * exacto del lugar donde la foto se va a mostrar. Lo que ve el admin aquí es lo
 * que se va a subir (no es solo preview — el canvas recorta el archivo final).
 *
 * Uso:
 *   <PhotoCropEditor file={pendingFile} open={!!pendingFile}
 *     onClose={() => setPendingFile(null)}
 *     onApply={(croppedFile) => uploadIt(croppedFile)}
 *     aspect={ASPECT_LANDING_CARD} />
 */
export default function PhotoCropEditor({
  file, open, onClose, onApply,
  aspect = ASPECT_LANDING_CARD,
  label = 'Ajustar foto',
  outputWidth = 1600,
}) {
  const [imageUrl, setImageUrl] = useState('');
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const dragStart = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const viewportRef = useRef(null);

  // Cargar la imagen al recibir el file
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Medir el viewport una vez que el modal está abierto y la imagen cargó
  useEffect(() => {
    if (!open || !viewportRef.current) return;
    const measure = () => {
      const r = viewportRef.current.getBoundingClientRect();
      setViewportSize({ w: r.width, h: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, imgSize.w]);

  // Escala base para que la imagen cubra el viewport en zoom=1
  const baseScale = imgSize.w && viewportSize.w
    ? Math.max(viewportSize.w / imgSize.w, viewportSize.h / imgSize.h)
    : 1;
  const scale = baseScale * zoom;
  const drawW = imgSize.w * scale;
  const drawH = imgSize.h * scale;

  // Re-centrar al abrir / cambiar imagen
  useEffect(() => {
    if (!viewportSize.w || !drawW) return;
    setZoom(1);
    setPan({
      x: (viewportSize.w - imgSize.w * baseScale) / 2,
      y: (viewportSize.h - imgSize.h * baseScale) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgSize.w, imgSize.h, viewportSize.w, viewportSize.h]);

  // Asegurar que la imagen siempre cubre el viewport (no se ven bordes vacíos)
  const clampPan = (p) => ({
    x: Math.min(0, Math.max(viewportSize.w - drawW, p.x)),
    y: Math.min(0, Math.max(viewportSize.h - drawH, p.y)),
  });

  useEffect(() => { setPan(p => clampPan(p)); /* re-clamp al cambiar zoom */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const onPointerDown = (e) => {
    if (!imgSize.w) return;
    setDragging(true);
    dragStart.current = { cx: e.clientX, cy: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    setPan(clampPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.cx),
      y: dragStart.current.py + (e.clientY - dragStart.current.cy),
    }));
  };
  const onPointerUp = (e) => {
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const apply = async () => {
    if (!imageUrl || !imgSize.w) return;
    setBusy(true);
    try {
      // Coordenadas fuente en la imagen original
      const srcX = -pan.x / scale;
      const srcY = -pan.y / scale;
      const srcW = viewportSize.w / scale;
      const srcH = viewportSize.h / scale;

      const OUT_W = Math.min(outputWidth, Math.round(imgSize.w * (viewportSize.w / drawW)));
      const OUT_H = Math.round(OUT_W / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.src = imageUrl;
      await new Promise(res => { img.onload = res; });
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUT_W, OUT_H);

      await new Promise((resolve) => {
        // WebP recorta ~25-30% vs JPEG a calidad equivalente. Si el navegador no
        // soporta toBlob con webp (raro hoy), el browser entrega null o el blob
        // resulta PNG; el siguiente paso de compresión normaliza el formato.
        canvas.toBlob((blob) => {
          if (!blob) { resolve(); return; }
          const base = (file?.name || 'foto').replace(/\.[^.]+$/, '');
          const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
          const cropped = new File([blob], `${base}-cropped.${ext}`, { type: blob.type || 'image/jpeg' });
          onApply(cropped);
          resolve();
        }, 'image/webp', 0.9);
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={label}>
      {!file || !imageUrl ? (
        <div className="text-text-muted text-sm py-8 text-center">Sin foto</div>
      ) : (
        <div>
          <div className="text-[11px] text-text-muted mb-2.5">
            Arrastra para mover · usa el deslizador para acercar. <span className="text-gold">Lo que veas aquí es exactamente como se verá publicada.</span>
          </div>

          <div
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full overflow-hidden rounded-xl bg-black/40 border border-border touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ aspectRatio: aspect }}>
            {imgSize.w > 0 && (
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                className="absolute pointer-events-none max-w-none"
                style={{ width: drawW, height: drawH, left: pan.x, top: pan.y }}
              />
            )}
            {/* Overlay guía: regla de los tercios sutil */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/10" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/10" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/10" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/10" />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <Icon name="search" size={14} color="var(--text-muted)" />
            <input type="range" min={1} max={4} step={0.05} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-gold cursor-pointer" />
            <span className="text-[11px] text-text-muted w-12 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex justify-between gap-2.5 pt-4 border-t border-border mt-4">
            <button type="button" onClick={() => { setZoom(1); setPan({
              x: (viewportSize.w - imgSize.w * baseScale) / 2,
              y: (viewportSize.h - imgSize.h * baseScale) / 2,
            }); }}
              className="text-[11px] text-text-muted hover:text-gold cursor-pointer underline underline-offset-2">
              Restablecer
            </button>
            <div className="flex gap-2.5">
              <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
              <Btn icon="check" onClick={apply} loading={busy} disabled={busy || !imgSize.w}>
                {busy ? 'Procesando…' : 'Aplicar y subir'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
