// Pase 2.0 · organización (26/11 · organizacion/app-socio.png): "¿Hay mucha gente?" en la app del socio. Las últimas 4 semanas, el mismo día,
// cuántos entraron por hora en promedio (ocupacion_por_hora, sin nombres), con la hora de ahora marcada; y la racha de semanas seguidas.
// Solo con la llave pase_2_organizacion (apagada, la base da error y la lectura tolerante vale null: no se muestra). Lo vacío no se muestra.
import { Icono } from "@/components/ui/Icono";

export type OcupacionPorHora = { dia: number; hora_actual: number; horas: { hora: number; promedio: number | string }[]; racha: { semanas_seguidas: number; mejor_racha: number } };

export function RachaSemanas({ datos }: { datos: OcupacionPorHora | null }) {
  const n = datos?.racha?.semanas_seguidas ?? 0;
  if (n < 1) return null;
  return <p className="pildora !text-base" data-racha-semanas={n}><Icono nombre="fuego" /> {n} {n === 1 ? "semana seguida" : "semanas seguidas"} viniendo</p>;
}

export function HayMuchaGente({ datos }: { datos: OcupacionPorHora | null }) {
  if (!datos || !datos.horas.length) return null;
  const desde = Math.min(...datos.horas.map((h) => h.hora), datos.hora_actual), hasta = Math.max(...datos.horas.map((h) => h.hora), datos.hora_actual);
  const valor = new Map(datos.horas.map((h) => [h.hora, Number(h.promedio)]));
  const max = Math.max(1, ...datos.horas.map((h) => Number(h.promedio)));
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const ahora = valor.get(datos.hora_actual) ?? 0;
  const texto = ahora >= max * 0.75 ? "A esta hora suele estar lleno" : ahora >= max * 0.4 ? "A esta hora suele haber gente" : "A esta hora suele estar tranquilo";
  return (
    <section aria-labelledby="hay-gente" className="tarjeta p-5 space-y-3" data-hay-mucha-gente>
      <h2 id="hay-gente" className="titulo text-2xl"><Icono nombre="usuarios" /> ¿Hay mucha gente?</h2>
      <p className="texto-suave">{texto}. Las últimas 4 semanas, este mismo día.</p>
      <div className="flex items-end gap-1 h-24" role="img" aria-label={`Entradas por hora; ahora son las ${datos.hora_actual}`}>
        {horas.map((h) => (
          <div key={h} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, ((valor.get(h) ?? 0) / max) * 100)}%`, background: h === datos.hora_actual ? "var(--acento)" : "var(--tarjeta-alta)" }} data-hora={h} data-ahora={h === datos.hora_actual ? "si" : undefined} />
            <span className={`text-[11px] ${h === datos.hora_actual ? "font-bold" : "texto-tenue"}`}>{h}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
