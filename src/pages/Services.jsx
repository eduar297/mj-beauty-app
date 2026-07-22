import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon, Modal, Btn, ListLoading, CAT_COLORS, CAT_ICONS, BeforeAfterPair, PhotoTile, Lightbox, photosToSlides } from '../components/ui.jsx';
import PublicBookingForm from '../components/PublicBookingForm.jsx';
import { api_services, api_service_photos } from '../lib/api';
import { fmtMoney } from '../lib/money';
import { fmtDuration as fmtDur } from '../lib/duration';

export default function Services() {
  const { cat: paramCat } = useParams();
  const nav = useNavigate();
  const cats = ['Uñas', 'Pedicura', 'Pelo', 'Faciales', 'Cejas', 'Pestañas'];
  const [activeCat, setActiveCat] = useState(paramCat || 'Uñas');
  const [services, setServices] = useState(null); // null = loading
  const [photosBy, setPhotosBy] = useState({}); // service_id → photos[]
  const [bookingService, setBookingService] = useState(null);
  const [detailService, setDetailService] = useState(null); // servicio que se ve en detalle
  const [lightbox, setLightbox] = useState(null); // { slides, index }
  const fmt = fmtMoney;
  // Helpers para mostrar rangos opcionales (e.g. "60-90 min", "$1.200 — $2.000").
  const fmtDuration = (s) =>
    s.duration_max && s.duration_max > s.duration
      ? `${fmtDur(s.duration)} – ${fmtDur(s.duration_max)}`
      : fmtDur(s.duration);
  const fmtPrice = (s) =>
    s.price_max && Number(s.price_max) > Number(s.price)
      ? `${fmt(s.price)} — ${fmt(s.price_max)}`
      : fmt(s.price);

  useEffect(() => {
    api_services.listPublic().then(({ data }) => setServices(data || []));
    api_service_photos.listAll().then(({ data }) => {
      const byService = {};
      for (const p of (data || [])) (byService[p.service_id] ??= []).push(p);
      setPhotosBy(byService);
    });
  }, []);

  const openLightboxFor = (serviceId, photoId) => {
    const photos = photosBy[serviceId] || [];
    const { slides, indexFor } = photosToSlides(photos);
    setLightbox({ slides, index: indexFor[photoId] ?? 0 });
  };

  const filtered = (services || []).filter(s => s.cat === activeCat);
  const SVC_IMGS = { 'Uñas': '/assets/svc-nails.png', 'Pedicura': '/assets/svc-nails.png', 'Pelo': '/assets/svc-hair.png', 'Faciales': '/assets/svc-facial.png', 'Cejas': '/assets/svc-cejas.png', 'Pestañas': '/assets/svc-pestanas.png' };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="sticky top-0 z-10 bg-bg-card/90 backdrop-blur border-b border-border h-16 flex items-center justify-between px-4 sm:px-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => nav('/')} className="border border-border rounded-lg px-3 py-1.5 text-xs text-text-secondary flex items-center gap-1 cursor-pointer hover:border-gold transition-colors">
            <Icon name="chevronLeft" size={13} /><span className="hidden sm:inline">Inicio</span>
          </button>
          <div className="font-serif font-semibold truncate" style={{ fontSize: 'clamp(16px,3vw,20px)' }}>
            Nuestros <span className="text-gold italic">Servicios</span>
          </div>
        </div>
        <button onClick={() => setBookingService('')} className="bg-gold text-[#0d0c0a] px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 cursor-pointer hover:opacity-90 transition">Reservar</button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-10 py-8">
        <div className="flex gap-2 mb-7 overflow-x-auto pb-1">
          {cats.map(c => {
            const color = CAT_COLORS[c]; const active = activeCat === c;
            return (
              <button key={c} onClick={() => setActiveCat(c)}
                style={{ background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? color + '55' : 'var(--border)' }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer">
                <Icon name={CAT_ICONS[c]} size={14} color={active ? color : 'var(--text-muted)'} />
                {c}
              </button>
            );
          })}
        </div>

        {services === null ? (
          <ListLoading label="Cargando servicios…" />
        ) : (
          <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 340px))' }}>
            {filtered.map(s => {
              const color = CAT_COLORS[s.cat];
              const photos = photosBy[s.id] || [];
              const hasMoreDescription = (s.description || '').length > 110;
              return (
                <div key={s.id} className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 motion-reduce:transform-none transition group flex flex-col">
                  {/* Foto principal — al tocar abre la galería en lightbox */}
                  <button type="button"
                    onClick={() => {
                      if (photos.length > 0) {
                        openLightboxFor(s.id, photos[0].id);
                      } else {
                        setDetailService(s);
                      }
                    }}
                    aria-label={`Ver fotos de ${s.name}`}
                    className="h-40 overflow-hidden relative cursor-pointer block w-full">
                    <img src={s.photo_url || SVC_IMGS[s.cat]} alt={s.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 motion-reduce:transform-none transition" />
                    {s.popular && (
                      <div style={{ background: `${color}cc` }} className="absolute top-2.5 right-2.5 text-[9px] font-bold text-[#0d0c0a] px-2 py-0.5 rounded-full uppercase tracking-wider">Popular</div>
                    )}
                    {photos.length > 0 && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Icon name="search" size={11} color="#fff" /> {photos.length}
                      </div>
                    )}
                  </button>

                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="font-semibold min-w-0">{s.name}</div>
                      <div className="font-serif font-bold text-lg flex-shrink-0 text-right" style={{ color }}>
                        {fmtPrice(s)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-muted mb-2.5">
                      <Icon name="clock" size={12} /> {fmtDuration(s)}
                    </div>

                    {/* Descripción con "Ver más" si es larga */}
                    {s.description && (
                      <p className="text-xs text-text-muted leading-relaxed mb-3 line-clamp-2">
                        {s.description}
                      </p>
                    )}
                    {hasMoreDescription && (
                      <button type="button" onClick={() => setDetailService(s)}
                        className="text-xs text-gold font-semibold cursor-pointer hover:underline self-start mb-3 -mt-1">
                        Ver más →
                      </button>
                    )}

                    <ServicePhotoStrip photos={photos} onOpen={(photoId) => openLightboxFor(s.id, photoId)} />

                    <div className="mt-auto pt-1 flex gap-2">
                      <button type="button" onClick={() => setDetailService(s)}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold border border-border text-text-secondary cursor-pointer hover:border-gold hover:text-gold transition">
                        Ver detalles
                      </button>
                      <button type="button" onClick={() => setBookingService(s.name)}
                        style={{ background: `${color}22`, borderColor: `${color}44`, color }}
                        className="flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer hover:opacity-90 transition">
                        Reservar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-text-muted py-12">Aún no hay servicios en esta categoría.</div>
            )}
          </div>
        )}
      </div>

      <Modal open={bookingService !== null} onClose={() => setBookingService(null)} title="Reservar Cita">
        {bookingService !== null && (
          <PublicBookingForm
            defaultService={bookingService}
            services={services || []}
            onClose={() => setBookingService(null)}
          />
        )}
      </Modal>

      {/* Modal de detalle del servicio: foto grande, descripción completa, galería + CTA */}
      <Modal open={detailService !== null} onClose={() => setDetailService(null)} title={detailService?.name || ''}>
        {detailService && (
          <ServiceDetail
            service={detailService}
            photos={photosBy[detailService.id] || []}
            fallbackImg={SVC_IMGS[detailService.cat]}
            color={CAT_COLORS[detailService.cat]}
            fmtPrice={fmtPrice}
            fmtDuration={fmtDuration}
            onOpenPhoto={(photoId) => openLightboxFor(detailService.id, photoId)}
            onReserve={() => { const name = detailService.name; setDetailService(null); setBookingService(name); }}
          />
        )}
      </Modal>

      <Lightbox open={!!lightbox} onClose={() => setLightbox(null)} slides={lightbox?.slides || []} index={lightbox?.index || 0} />
    </div>
  );
}

function ServiceDetail({ service, photos, fallbackImg, color, fmtPrice, fmtDuration, onOpenPhoto, onReserve }) {
  const heroSrc = service.photo_url || fallbackImg;
  return (
    <div>
      {/* Hero photo grande, clickeable si hay galería */}
      <button type="button"
        onClick={() => photos.length > 0 && onOpenPhoto(photos[0].id)}
        disabled={photos.length === 0}
        aria-label={photos.length > 0 ? 'Ver fotos del servicio en grande' : ''}
        className="relative w-full h-52 sm:h-60 rounded-xl overflow-hidden mb-4 block disabled:cursor-default cursor-pointer">
        <img src={heroSrc} alt={service.name} className="w-full h-full object-cover" />
        {service.popular && (
          <div style={{ background: `${color}cc` }} className="absolute top-3 right-3 text-[10px] font-bold text-[#0d0c0a] px-2.5 py-1 rounded-full uppercase tracking-wider">
            Popular
          </div>
        )}
        {photos.length > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Icon name="search" size={12} color="#fff" /> Ver galería ({photos.length})
          </div>
        )}
      </button>

      {/* Precio + duración + categoría */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="text-xs uppercase tracking-widest text-text-muted">{service.cat}</div>
        <div className="font-serif font-bold text-xl" style={{ color }}>{fmtPrice(service)}</div>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-text-secondary mb-4">
        <Icon name="clock" size={14} /> {fmtDuration(service)}
      </div>

      {/* Descripción completa (sin truncar) */}
      {service.description && (
        <p className="text-sm text-text-secondary leading-relaxed mb-4 whitespace-pre-wrap">
          {service.description}
        </p>
      )}

      {/* Galería de fotos extra (si hay más de una) */}
      {photos.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">Fotos</div>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.slice(0, 9).map(p => (
              <button key={p.id} type="button" onClick={() => onOpenPhoto(p.id)}
                aria-label="Ver foto"
                className="relative rounded-lg overflow-hidden border border-border bg-bg-elevated aspect-square cursor-pointer hover:border-gold/60 transition">
                {p.kind === 'pair' ? (
                  <div className="grid grid-cols-2 gap-px bg-border w-full h-full">
                    <img src={p.before_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    <img src={p.after_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                )}
                {p.kind === 'combined' && (
                  <span className="absolute bottom-0 inset-x-0 bg-black/65 text-gold text-[9px] font-bold text-center uppercase tracking-wider py-0.5">A/D</span>
                )}
              </button>
            ))}
          </div>
          {photos.length > 9 && (
            <div className="text-[11px] text-text-muted mt-2">+ {photos.length - 9} más en la galería</div>
          )}
        </div>
      )}

      <button type="button" onClick={onReserve}
        style={{ background: color, color: '#0d0c0a' }}
        className="w-full py-3 rounded-lg text-sm font-bold cursor-pointer hover:opacity-90 transition">
        Reservar este servicio
      </button>
    </div>
  );
}

function ServicePhotoStrip({ photos, onOpen }) {
  if (!photos || photos.length === 0) return null;
  const MAX = 4;
  const visible = photos.slice(0, MAX);
  const extra = photos.length - visible.length;
  return (
    <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
      {visible.map((p, i) => (
        <button key={p.id} type="button" onClick={() => onOpen(p.id)}
          className="relative flex-shrink-0 rounded-lg overflow-hidden border border-border bg-bg-elevated cursor-pointer hover:border-gold/50 transition"
          style={{ width: p.kind === 'pair' ? 96 : 56, height: 56 }}
          aria-label="Ver foto">
          {p.kind === 'pair' ? (
            <div className="grid grid-cols-2 gap-px bg-border w-full h-full">
              <img src={p.before_url} alt="Antes" loading="lazy" className="w-full h-full object-cover" />
              <img src={p.after_url} alt="Después" loading="lazy" className="w-full h-full object-cover" />
            </div>
          ) : (
            <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
          )}
          {p.kind === 'combined' && (
            <span className="absolute bottom-0 inset-x-0 bg-bg-card/85 text-gold text-[8px] font-bold text-center uppercase tracking-wider py-0.5">A/D</span>
          )}
          {i === visible.length - 1 && extra > 0 && (
            <span className="absolute inset-0 bg-black/55 text-text-primary text-xs font-bold grid place-items-center">+{extra}</span>
          )}
        </button>
      ))}
    </div>
  );
}

