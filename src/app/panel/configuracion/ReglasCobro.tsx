"use client";
// VD-7 / VD-8 · Configuración → Cobros: "Cómo vencen las cuotas" (D18) y "Dejar pasar sin pagar" (D19).
// Lo que se guarda vale para los cobros NUEVOS: lo ya cobrado no se toca. Las cuentas las hace la base.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { formatearPesos } from "@/lib/formato";
import {
  guardarConfigDejarPasar, guardarReglaPlan, guardarReglaVencimiento, simularCuota,
  type ConfigDejarPasar, type ModoDejarPasar, type PrimeraCuotaModo, type Renovacion, type ReglasVencimiento, type Simulacion,
} from "./cobros-acciones";

const RENOVACIONES: { clave: Renovacion; titulo: string; ejemplo: string }[] = [
  { clave: "desde_pago", titulo: "Desde el día que paga", ejemplo: "Pagó el 20/11 → vence el 20/12." },
  { clave: "continua", titulo: "Continua", ejemplo: "Vencía el 10 y pagó el 15 → el mes nuevo sigue desde el 10." },
  { clave: "dia_fijo", titulo: "Día fijo", ejemplo: "Todos vencen el mismo día y pagan en una ventana (por ejemplo, del 1 al 10)." },
];
const PRIMERAS: { clave: PrimeraCuotaModo; titulo: string; ayuda: string }[] = [
  { clave: "proporcional", titulo: "Paga proporcional", ayuda: "Paga los días que faltan hasta el día fijo (redondeado) y desde ahí entra al ciclo de todos." },
  { clave: "mes_entero", titulo: "Mes entero", ayuda: "Paga la cuota entera y queda cubierto hasta el día fijo del mes siguiente." },
  { clave: "gratis", titulo: "Gratis hasta el día fijo", ayuda: "No paga hasta el próximo día fijo." },
  { clave: "completo", titulo: "Como hasta ahora", ayuda: "Paga la cuota entera, que cubre desde el último día fijo (aunque ya haya pasado)." },
];
const fechaCorta = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(iso));

export function ReglasVencimiento({ inicial, puedeEditar }: { inicial: ReglasVencimiento; puedeEditar: boolean }) {
  const [r, setR] = useState(inicial);
  const [renovacion, setRenovacion] = useState<Renovacion>(inicial.renovacion);
  const [dia, setDia] = useState<number | "">(inicial.dia_fijo ?? "");
  const [primera, setPrimera] = useState<PrimeraCuotaModo>(inicial.primera_cuota);
  const [redondeo, setRedondeo] = useState(Number(inicial.redondeo));
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [planSim, setPlanSim] = useState(inicial.planes[0]?.plan_id ?? "");
  const [diaSim, setDiaSim] = useState("");
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [errSim, setErrSim] = useState<string | null>(null);

  const sucio = renovacion !== r.renovacion || (renovacion === "dia_fijo" && dia !== (r.dia_fijo ?? "")) || primera !== r.primera_cuota || redondeo !== Number(r.redondeo);
  const aplicar = (n: ReglasVencimiento) => { setR(n); setRenovacion(n.renovacion); setDia(n.dia_fijo ?? ""); setPrimera(n.primera_cuota); setRedondeo(Number(n.redondeo)); };

  const guardar = async () => {
    setMsj(null);
    const x = await guardarReglaVencimiento({ renovacion, dia_fijo: renovacion === "dia_fijo" ? (dia === "" ? null : dia) : null, primera_cuota: primera, redondeo });
    if (x.error || !x.reglas) { setMsj({ tipo: "error", texto: x.error ?? "No se pudo guardar." }); return; }
    aplicar(x.reglas); setSim(null);
    setMsj({ tipo: "exito", texto: "Guardado. Vale para los cobros nuevos; lo que ya se cobró no cambia." });
  };
  const calcular = async () => {
    setErrSim(null); setSim(null);
    if (!planSim || !diaSim) { setErrSim("Elegí un plan y un día."); return; }
    const x = await simularCuota(planSim, diaSim);
    if (x.error || !x.simulacion) setErrSim(x.error ?? "No se pudo calcular."); else setSim(x.simulacion);
  };
  const ventana = r.tolerancia_dias != null && r.tolerancia_dias > 0 && r.dia_fijo ? `Se paga del ${r.dia_fijo} al ${r.dia_fijo + r.tolerancia_dias} (los días de gracia están en la pestaña Reglas).` : null;

  return (
    <section className="tarjeta p-5 space-y-4" data-reglas-vencimiento>
      <div>
        <h2 className="titulo text-2xl">📅 Cómo vencen las cuotas</h2>
        <p className="texto-suave">Cada plan puede usar esta regla o tener la suya. Un cambio se aplica a los cobros nuevos: lo que ya cobraste no se toca.</p>
        {!r.configurado && <p className="texto-tenue text-sm mt-1">Todavía no la configuraste: hoy cada plan usa la suya y la primera cuota con día fijo cubre desde el último día fijo.</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Cómo vencen las cuotas">
        {RENOVACIONES.map((o) => (
          <label key={o.clave} className={`tarjeta p-3 cursor-pointer space-y-1 ${renovacion === o.clave ? "!border-[var(--acento)]" : ""}`}>
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="renovacion" checked={renovacion === o.clave} disabled={!puedeEditar} onChange={() => setRenovacion(o.clave)} />{o.titulo}
            </span>
            <span className="block text-sm texto-suave">{o.ejemplo}</span>
          </label>
        ))}
      </div>

      {renovacion === "dia_fijo" && (
        <div className="space-y-4" data-dia-fijo>
          <label className="block space-y-1 max-w-xs">
            <span className="etiqueta">¿Qué día vencen todos? (1 a 28)</span>
            <input type="number" inputMode="numeric" min={1} max={28} className="campo" disabled={!puedeEditar} value={dia}
              onChange={(e) => setDia(e.target.value === "" ? "" : Number(e.target.value))} />
            {ventana && <span className="block text-sm texto-tenue">{ventana}</span>}
          </label>
          <div>
            <p className="font-semibold">Si alguien se anota a mitad de mes</p>
            <div className="grid gap-2 sm:grid-cols-2 mt-2" role="radiogroup" aria-label="Primera cuota con día fijo">
              {PRIMERAS.map((o) => (
                <label key={o.clave} className={`tarjeta p-3 cursor-pointer space-y-1 ${primera === o.clave ? "!border-[var(--acento)]" : ""}`}>
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="primera" checked={primera === o.clave} disabled={!puedeEditar} onChange={() => setPrimera(o.clave)} />{o.titulo}
                  </span>
                  <span className="block text-sm texto-suave">{o.ayuda}</span>
                </label>
              ))}
            </div>
          </div>
          {primera === "proporcional" && (
            <label className="block space-y-1 max-w-xs">
              <span className="etiqueta">Redondear el proporcional a</span>
              <select className="campo" disabled={!puedeEditar} value={redondeo} onChange={(e) => setRedondeo(Number(e.target.value))}>
                {[[0, "No redondear (al centavo)"], [50, "$50"], [100, "$100"], [500, "$500"], [1000, "$1.000"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-3">
          <BotonAccion className="boton boton-principal" disabled={!sucio} onClick={guardar}>💾 Guardar</BotonAccion>
          {sucio && <span className="texto-tenue text-sm">Hay cambios sin guardar</span>}
        </div>
      )}
      {!puedeEditar && <p className="texto-tenue text-sm">Lo cambia el dueño.</p>}
      {msj && <Mensaje tipo={msj.tipo}>{msj.texto}</Mensaje>}
      {r.ultimo_cambio && <p className="texto-tenue text-sm" data-ultimo-cambio>Último cambio: {r.ultimo_cambio.por ?? "alguien"}, {fechaCorta(r.ultimo_cambio.cuando)} · {r.ultimo_cambio.detalle}.</p>}

      {r.planes.length > 0 && (
        <div className="space-y-2" data-simulador>
          <p className="font-semibold">¿Y si alguien se anota el…?</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="campo" aria-label="Plan" value={planSim} onChange={(e) => setPlanSim(e.target.value)}>
              {r.planes.map((p) => <option key={p.plan_id} value={p.plan_id}>{p.nombre}</option>)}
            </select>
            <input type="date" className="campo" aria-label="Día en que se anota" value={diaSim} onChange={(e) => setDiaSim(e.target.value)} />
            <BotonAccion className="boton" ocupadoTexto="Calculando…" onClick={calcular}>🧮 Calcular</BotonAccion>
          </div>
          {errSim && <Mensaje tipo="error">{errSim}</Mensaje>}
          {sim && (
            <Mensaje tipo="info"><span data-simulacion>
              {sim.texto} {sim.precio != null && <strong>{formatearPesos(sim.precio)}{sim.parcial && sim.precio_lista != null && sim.precio !== sim.precio_lista ? ` (la cuota entera es ${formatearPesos(sim.precio_lista)})` : ""}</strong>}
            </span></Mensaje>
          )}
          <p className="texto-tenue text-sm">Es la misma cuenta que hace la caja al cobrar; no cobra nada.</p>
        </div>
      )}

      {r.planes.length > 0 && <PlanesRegla reglas={r} puedeEditar={puedeEditar} alCambiar={aplicar} />}
    </section>
  );
}

function PlanesRegla({ reglas, puedeEditar, alCambiar }: { reglas: ReglasVencimiento; puedeEditar: boolean; alCambiar: (r: ReglasVencimiento) => void }) {
  return (
    <div className="space-y-2" data-reglas-planes>
      <p className="font-semibold">Cada plan</p>
      <ul className="divide-y divide-[var(--borde)]">
        {reglas.planes.map((p) => <FilaPlan key={`${p.plan_id}-${p.usa_regla_gimnasio}-${p.renovacion}-${p.dia_fijo}`} p={p} puedeEditar={puedeEditar} hayRegla={reglas.configurado} alCambiar={alCambiar} />)}
      </ul>
    </div>
  );
}

const NOMBRE_RENOVACION: Record<Renovacion, string> = { continua: "continua", desde_pago: "desde el día que paga", dia_fijo: "día fijo" };

function FilaPlan({ p, puedeEditar, hayRegla, alCambiar }: { p: ReglasVencimiento["planes"][number]; puedeEditar: boolean; hayRegla: boolean; alCambiar: (r: ReglasVencimiento) => void }) {
  const [valor, setValor] = useState<"gimnasio" | Renovacion>(p.usa_regla_gimnasio ? "gimnasio" : p.renovacion);
  const [dia, setDia] = useState<number | "">(p.dia_fijo ?? "");
  const [error, setError] = useState<string | null>(null);
  const igual = valor === (p.usa_regla_gimnasio ? "gimnasio" : p.renovacion) && (valor !== "dia_fijo" || dia === (p.dia_fijo ?? ""));
  const guardar = async () => {
    setError(null);
    const x = valor === "gimnasio" ? await guardarReglaPlan(p.plan_id, true) : await guardarReglaPlan(p.plan_id, false, valor, valor === "dia_fijo" ? (dia === "" ? null : dia) : null);
    if (x.error || !x.reglas) setError(x.error ?? "No se pudo guardar."); else alCambiar(x.reglas);
  };
  return (
    <li className="py-3 space-y-2" data-plan-regla={p.plan_id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold flex-1 min-w-[8rem]">{p.nombre}</span>
        <span className="texto-tenue text-sm">Hoy: {NOMBRE_RENOVACION[p.rige_renovacion]}{p.rige_renovacion === "dia_fijo" && p.rige_dia_fijo ? ` el ${p.rige_dia_fijo}` : ""}</span>
      </div>
      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-2">
          <select className="campo !w-auto" aria-label={`Cómo vence ${p.nombre}`} value={valor} onChange={(e) => setValor(e.target.value as "gimnasio" | Renovacion)}>
            <option value="gimnasio" disabled={!hayRegla}>Como el gimnasio{hayRegla ? "" : " (elegí la regla arriba)"}</option>
            <option value="continua">Continua</option><option value="desde_pago">Desde el día que paga</option><option value="dia_fijo">Día fijo</option>
          </select>
          {valor === "dia_fijo" && <input type="number" inputMode="numeric" min={1} max={28} className="campo !w-24" aria-label="Día fijo" value={dia} onChange={(e) => setDia(e.target.value === "" ? "" : Number(e.target.value))} />}
          <BotonAccion className="boton" disabled={igual} onClick={guardar}>Guardar</BotonAccion>
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </li>
  );
}

// ── VD-8 · Dejar pasar sin pagar ─────────────────────────────────────
const MODOS: { clave: ModoDejarPasar; titulo: string; ayuda: (dias: number) => string }[] = [
  { clave: "recepcion_hasta_dias", titulo: "La recepción hasta N días", ayuda: (n) => `La recepción decide sola si el socio promete pagar dentro de ${n} día${n === 1 ? "" : "s"}; más lejos pide el PIN del dueño o del encargado.` },
  { clave: "siempre_pin", titulo: "Siempre con PIN", ayuda: () => "Siempre lo autoriza el dueño o el encargado con su PIN." },
  { clave: "libre", titulo: "Libre, con registro", ayuda: () => "La recepción decide; queda anotado con nombre, motivo y fecha prometida, y el dueño lo ve en la lista." },
];

export function ConfigDejarPasarCard({ inicial, puedeEditar }: { inicial: ConfigDejarPasar; puedeEditar: boolean }) {
  const [c, setC] = useState(inicial);
  const [modo, setModo] = useState<ModoDejarPasar>(inicial.modo);
  const [dias, setDias] = useState<number | "">(inicial.dias_max);
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const sucio = modo !== c.modo || (modo === "recepcion_hasta_dias" && dias !== c.dias_max);
  const guardar = async () => {
    setMsj(null);
    const x = await guardarConfigDejarPasar(modo, dias === "" ? 3 : dias);
    if (x.error || !x.config) { setMsj({ tipo: "error", texto: x.error ?? "No se pudo guardar." }); return; }
    setC(x.config); setModo(x.config.modo); setDias(x.config.dias_max);
    setMsj({ tipo: "exito", texto: "Guardado. Vale desde ahora para quien deje pasar." });
  };
  return (
    <section className="tarjeta p-5 space-y-4" data-dejar-pasar-config>
      <div>
        <h2 className="titulo text-2xl">🤝 Dejar pasar sin pagar</h2>
        <p className="texto-suave">Cuando alguien no puede entrar y dice “mañana pago”. Siempre queda anotado quién lo dejó pasar, por qué y qué día prometió pagar. A un suspendido o dado de baja solo lo deja pasar el dueño o el encargado, y el tope por día de la recepción ({c.tope_por_dia}) sigue valiendo (pestaña Reglas).</p>
        {!c.configurado && <p className="texto-tenue text-sm mt-1">Todavía no lo elegiste: hoy la recepción decide libremente (con el tope por día).</p>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Cómo se deja pasar sin pagar">
        {MODOS.map((o) => (
          <label key={o.clave} className={`tarjeta p-3 cursor-pointer space-y-1 ${modo === o.clave ? "!border-[var(--acento)]" : ""}`}>
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="modo-dejar-pasar" checked={modo === o.clave} disabled={!puedeEditar} onChange={() => setModo(o.clave)} />{o.titulo}
            </span>
            <span className="block text-sm texto-suave">{o.ayuda(typeof dias === "number" ? dias : c.dias_max)}</span>
          </label>
        ))}
      </div>
      {modo === "recepcion_hasta_dias" && (
        <label className="block space-y-1 max-w-xs">
          <span className="etiqueta">N: hasta cuántos días de promesa decide la recepción</span>
          <input type="number" inputMode="numeric" min={0} max={30} className="campo" disabled={!puedeEditar} value={dias}
            onChange={(e) => setDias(e.target.value === "" ? "" : Number(e.target.value))} />
        </label>
      )}
      {puedeEditar ? (
        <div className="flex flex-wrap items-center gap-3">
          <BotonAccion className="boton boton-principal" disabled={!sucio} onClick={guardar}>💾 Guardar</BotonAccion>
          {sucio && <span className="texto-tenue text-sm">Hay cambios sin guardar</span>}
        </div>
      ) : <p className="texto-tenue text-sm">Lo cambia el dueño.</p>}
      {msj && <Mensaje tipo={msj.tipo}>{msj.texto}</Mensaje>}
      {c.ultimo_cambio && <p className="texto-tenue text-sm">Último cambio: {c.ultimo_cambio.por ?? "alguien"}, {fechaCorta(c.ultimo_cambio.cuando)}.</p>}
    </section>
  );
}
