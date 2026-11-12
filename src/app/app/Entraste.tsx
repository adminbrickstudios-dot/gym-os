import { Icono } from "@/components/ui/Icono";
// VD-23: "Entraste 19:04 ✓ · llevás 12 este mes", con una animación corta; en un hito (10, 50, 100…) hay confeti.
// La hora y las cuentas las da la base; acá solo se muestran. El confeti es CSS y se apaga con "reducir movimiento".
const COLORES = ["var(--acento)", "var(--verde)", "var(--amarillo)", "var(--rojo)"];

export function Entraste({ momento, zona, delMes, racha, hito }: { momento: string; zona: string; delMes: number; racha: number; hito: number | null }) {
  const hora = new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(momento));
  return (
    <section className="tarjeta p-4 aparecer relative overflow-hidden" data-entraste={hora} role="status">
      <p className="titulo text-xl"><span className="entraste-tilde" aria-hidden><Icono nombre="ok" /></span> Entraste {hora}</p>
      <p className="texto-suave">Llevás {delMes} {delMes === 1 ? "vez" : "veces"} este mes{racha >= 2 ? ` · ${racha} semanas seguidas` : ""}</p>
      {hito != null && (
        <>
          <p className="mt-2 font-semibold" data-hito={hito}><Icono nombre="estrella" /> ¡{hito} entradas! Gracias por entrenar con nosotros.</p>
          <div aria-hidden className="confeti">{Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, background: COLORES[i % COLORES.length], animationDelay: `${(i % 6) * 0.12}s` }} />
          ))}</div>
        </>
      )}
      <style>{`
        .entraste-tilde{display:inline-block;animation:entraste-pop .5s cubic-bezier(.2,1.4,.4,1) both;color:var(--verde)}
        @keyframes entraste-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
        .confeti{position:absolute;inset:0;pointer-events:none}
        .confeti i{position:absolute;top:-8px;width:7px;height:12px;border-radius:2px;animation:confeti-cae 1.8s ease-in both}
        @keyframes confeti-cae{from{transform:translateY(0) rotate(0);opacity:1}to{transform:translateY(140px) rotate(540deg);opacity:0}}
        @media (prefers-reduced-motion: reduce){.entraste-tilde,.confeti i{animation:none}.confeti{display:none}}
      `}</style>
    </section>
  );
}
