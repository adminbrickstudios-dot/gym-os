"use client";
// VD-17 · Lo que la base ya tenía de cada plan y no tenía pantalla: cómo vence, tolerancia, cuándo
// descuenta una clase el pack, en qué sedes vale y si se ve en la página. Más "cómo lo ve el socio".
import { useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { guardarAjustesPlan, type AjustesPlan, type AjustesPlanes } from "./acciones";

type Renov = "gimnasio" | "continua" | "desde_pago" | "dia_fijo";
const NOMBRE_RENOV: Record<string, string> = { continua: "continua", desde_pago: "desde el día que paga", dia_fijo: "día fijo" };

/** Lo que importa de los ajustes, en frases cortas para la fila del plan. */
export function resumenAjustes(tipo: string, a: AjustesPlan | undefined, r: AjustesPlanes | null, sedes: { sede_id: string; nombre: string }[]): string[] {
  if (!a) return [];
  const f: string[] = [];
  if (tipo === "membresia" && a.renovacion) {
    f.push(`vence ${a.renovacion === "dia_fijo" ? `el día ${a.dia_fijo} de cada mes` : NOMBRE_RENOV[a.renovacion] ?? a.renovacion}${a.usa_regla_gimnasio ? " (como el gimnasio)" : ""}`);
    if (a.tolerancia_dias != null) f.push(`tolerancia ${a.tolerancia_dias} ${a.tolerancia_dias === 1 ? "día" : "días"}`);
  }
  if (tipo === "pack" && a.consume_en) f.push(a.consume_en === "asistencia" ? "descuenta al tomar asistencia" : "descuenta al entrar");
  if (!a.todas_las_sedes && a.sedes.length) f.push(`solo en ${sedes.filter((s) => a.sedes.includes(s.sede_id)).map((s) => s.nombre).join(", ") || "algunas sedes"}`);
  if (!a.visible_en_landing) f.push("no se ve en la página: solo la vende la recepción");
  return f;
}

export function AjustesDelPlan({ planId, tipo, a, r, cerrar }: {
  planId: string; tipo: string; a: AjustesPlan; r: AjustesPlanes; cerrar: () => void;
}) {
  const inicial: Renov = a.usa_regla_gimnasio ? "gimnasio" : ((a.renovacion_propia as Renov | null) ?? "continua");
  const diaInicial = String(a.dia_fijo_propio ?? a.dia_fijo ?? 1);
  const [renov, setRenov] = useState<Renov>(inicial);
  const [dia, setDia] = useState(diaInicial);
  const [tol, setTol] = useState(a.tolerancia_dias != null ? String(a.tolerancia_dias) : "");
  const [consume, setConsume] = useState(a.consume_en ?? "ingreso");
  const [visible, setVisible] = useState(a.visible_en_landing);
  const [todas, setTodas] = useState(a.todas_las_sedes);
  const [sedes, setSedes] = useState<string[]>(a.sedes);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const esMembresia = tipo === "membresia", esPack = tipo === "pack";
  const reglaG = r.regla_gimnasio;
  return (
    <form className="grid sm:grid-cols-2 gap-3 mt-4" data-ajustes-plan onSubmit={(e) => {
      e.preventDefault();
      empezar(async () => {
        const res = await guardarAjustesPlan(planId, {
          renovacion: renov, diaFijo: dia, tolerancia: tol, consumeEn: consume, visible, todasLasSedes: todas, sedes, esMembresia, esPack,
          cambioRegla: renov !== inicial || (renov === "dia_fijo" && dia !== diaInicial),
        });
        setError(res.error ?? null);
        if (!res.error) cerrar();
      });
    }}>
      {esMembresia && (
        <fieldset className="sm:col-span-2 space-y-1"><legend className="etiqueta mb-1">Cuándo vence la cuota</legend>
          <div className="flex flex-wrap items-center gap-2">
            <select className="campo !w-auto" aria-label="Cómo vence" value={renov} onChange={(e) => setRenov(e.target.value as Renov)}>
              {reglaG && <option value="gimnasio">Como el gimnasio ({reglaG.renovacion === "dia_fijo" ? `día ${reglaG.dia_fijo}` : NOMBRE_RENOV[reglaG.renovacion]})</option>}
              <option value="continua">Continua</option><option value="desde_pago">Desde el día que paga</option><option value="dia_fijo">Día fijo</option>
            </select>
            {renov === "dia_fijo" && (
              <label className="flex items-center gap-2">el día <input className="campo !w-20" inputMode="numeric" aria-label="Día fijo" value={dia} onChange={(e) => setDia(e.target.value)} /> de cada mes</label>
            )}
          </div>
          <p className="text-sm texto-tenue">Rige para los cobros nuevos; lo ya cobrado no cambia. Lo cambia el dueño.</p>
        </fieldset>
      )}
      {esMembresia && (
        <label className="space-y-1"><span className="etiqueta">Días de tolerancia (vacío = los {r.tolerancia_gimnasio ?? 0} del gimnasio)</span>
          <input className="campo" inputMode="numeric" aria-label="Días de tolerancia" value={tol} onChange={(e) => setTol(e.target.value)} placeholder={String(r.tolerancia_gimnasio ?? 0)} /></label>
      )}
      {esPack && (
        <fieldset className="space-y-1"><legend className="etiqueta mb-1">Cuándo se descuenta una clase</legend>
          <div className="flex flex-wrap gap-2">
            {[["ingreso", "Al entrar"], ["asistencia", "Al tomar asistencia"]].map(([k, t]) => (
              <label key={k} className={`boton !min-h-11 cursor-pointer ${consume === k ? "!border-[var(--acento)]" : ""}`}>
                <input type="radio" name={`consume-${planId}`} className="sr-only" checked={consume === k} onChange={() => setConsume(k)} />{consume === k ? "✓ " : ""}{t}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="sm:col-span-2 space-y-1"><legend className="etiqueta mb-1">Dónde se vende</legend>
        <label className="flex items-center gap-2 min-h-11"><input type="checkbox" className="w-5 h-5" aria-label="Se ve en la página" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          <span>Se ve en la página y en el alta online <span className="texto-tenue">(apagado: solo lo vende la recepción)</span></span></label>
        {r.sedes.length > 1 && (
          <>
            <label className="flex items-center gap-2 min-h-11"><input type="checkbox" className="w-5 h-5" aria-label="Vale en todas las sedes" checked={todas} onChange={(e) => setTodas(e.target.checked)} />Vale en todas las sedes</label>
            {!todas && (
              <div className="flex flex-wrap gap-2">
                {r.sedes.map((s) => {
                  const si = sedes.includes(s.sede_id);
                  return (
                    <label key={s.sede_id} className={`boton !min-h-11 cursor-pointer ${si ? "!border-[var(--acento)]" : ""}`}>
                      <input type="checkbox" className="sr-only" checked={si} aria-label={s.nombre} onChange={() => setSedes(si ? sedes.filter((x) => x !== s.sede_id) : [...sedes, s.sede_id])} />{si ? "✓ " : ""}{s.nombre}
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}
      </fieldset>
      {error && <p role="alert" className="pildora pildora-rojo sm:col-span-2">⚠️ {error}</p>}
      <div className="flex gap-2 sm:col-span-2"><button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button><button type="button" className="boton" onClick={cerrar}>Cancelar</button></div>
    </form>
  );
}

/** "Así lo ve el socio": la tarjeta del plan como sale en la página y en la app. */
export function VistaPrevia({ nombre, descripcion, precio, detalle, cerrar }: { nombre: string; descripcion: string | null; precio: number | null; detalle: string[]; cerrar: () => void }) {
  return (
    <div className="mt-4" data-vista-previa>
      <p className="etiqueta mb-2">Así lo ve el socio</p>
      <div className="tarjeta p-5 max-w-sm border-[var(--acento)]">
        <p className="font-semibold text-xl">{nombre}</p>
        <p className="numero text-4xl mt-1">{precio != null ? formatearPesos(precio) : "Consultar"}</p>
        {descripcion && <p className="texto-suave mt-2">{descripcion}</p>}
        {detalle.length > 0 && <ul className="mt-3 space-y-1 text-sm">{detalle.map((d) => <li key={d}>✓ {d}</li>)}</ul>}
      </div>
      <button type="button" className="boton mt-3" onClick={cerrar}>Cerrar</button>
    </div>
  );
}
