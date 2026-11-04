"use client";
import { useEffect, useState, useTransition } from "react";
import { propsMarca } from "@/lib/marca";
import { guardarConfiguracion } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { Interruptor } from "@/components/ui/Interruptor";

export type Config = {
  nombre: string; color_acento: string; color_fondo: string; cobra_membresia: boolean; cobra_pase: boolean; cobra_pack: boolean;
  modo_clases: string; tolerancia_dias: number; dias_aviso: number; secciones_apagadas: string[]; alias_transferencia: string | null;
  cbu: string | null; titular_cuenta: string | null; descuento_max_recepcion: number; retencion_dias_ausencia: number;
  reserva_dias_anticipacion: number; cancelacion_horas_limite: number;
};
type Campo = keyof Config;

const FONDOS = ["#14161b", "#101418", "#16121f", "#1a1512", "#0f1a14", "#faf7f0"];
const ACENTOS = ["#2fbf5b", "#f5c518", "#3b82f6", "#a78bfa", "#ef4444", "#f97316", "#14b8a6"];
const SECCIONES: [string, string, string][] = [
  ["entrada", "🚪 Entrada", "Recepción busca al socio y le marca la entrada."],
  ["vencen_hoy", "⏰ Vencen hoy", "La lista de los que vencen y a quién avisar."],
  ["socios", "👥 Socios", "Fichas, altas y búsqueda."],
  ["retencion", "📉 Retención", "Los que dejaron de venir, para llamarlos antes de perderlos."],
  ["vender", "🛒 Vender", "Cobrar membresías, pases y productos."],
  ["caja", "💵 Caja", "Abrir y cerrar caja. Sin caja no se cobra en efectivo: Vender ofrece solo transferencia y tarjeta."],
  ["transferencias", "🧾 Transferencias", "Aprobar los comprobantes que mandan los socios."],
];

/** Los números de cada campo, igual que la base: si no cierra, ni se manda. */
const RANGOS: Partial<Record<Campo, [number, number, string]>> = {
  tolerancia_dias: [0, 60, "Días de gracia al vencer"],
  dias_aviso: [0, 30, "Avisar que vence"],
  descuento_max_recepcion: [0, 100, "Descuento máximo de la recepción"],
  retencion_dias_ausencia: [3, 90, "“No viene” después de"],
  reserva_dias_anticipacion: [0, 60, "Se reserva con hasta"],
  cancelacion_horas_limite: [0, 72, "Cancelar hasta"],
};

const BLOQUES = {
  marca: ["nombre", "color_fondo", "color_acento"],
  cobro: ["cobra_membresia", "cobra_pase", "cobra_pack"],
  clases: ["modo_clases", "reserva_dias_anticipacion", "cancelacion_horas_limite"],
  reglas: ["tolerancia_dias", "dias_aviso", "descuento_max_recepcion", "retencion_dias_ausencia"],
  transferencias: ["alias_transferencia", "cbu", "titular_cuenta"],
  secciones: ["secciones_apagadas"],
} satisfies Record<string, Campo[]>;
type IdBloque = keyof typeof BLOQUES;

const normal = (v: unknown) => (Array.isArray(v) ? [...v].sort() : v === "" ? null : v ?? null);
const igual = (a: unknown, b: unknown) => JSON.stringify(normal(a)) === JSON.stringify(normal(b));

/** Lo que el navegador puede decir antes de mandar. La base valida igual. */
function problema(c: Config, campos: Campo[]): string | null {
  for (const k of campos) {
    const r = RANGOS[k];
    if (!r) continue;
    const v = c[k] as unknown;
    if (v === "" || v === null || Number.isNaN(v)) return `${r[2]}: no puede quedar vacío, poné un número entre ${r[0]} y ${r[1]}.`;
    if ((v as number) < r[0] || (v as number) > r[1]) return `${r[2]}: tiene que estar entre ${r[0]} y ${r[1]}.`;
  }
  if (campos.includes("nombre") && !c.nombre.trim()) return "El nombre del gimnasio es obligatorio.";
  if (campos.includes("cobra_membresia") && !c.cobra_membresia && !c.cobra_pase && !c.cobra_pack)
    return "Dejá prendida al menos una forma de cobrar (membresía, pase diario o pack de clases).";
  if (campos.includes("alias_transferencia") && c.alias_transferencia?.trim() && !/^[A-Za-z0-9.-]{6,20}$/.test(c.alias_transferencia.trim()))
    return "El alias tiene que tener de 6 a 20 caracteres: letras, números, puntos o guiones, sin espacios.";
  if (campos.includes("cbu") && c.cbu?.trim()) {
    const digitos = c.cbu.replace(/[\s-]/g, "");
    if (!/^[0-9]{22}$/.test(digitos)) return `El CBU o CVU tiene 22 números (sin letras). El que pusiste tiene ${digitos.replace(/\D/g, "").length}.`;
  }
  return null;
}

type Respuesta = { ok?: string; error?: string; n: number };

function Bloque({ id, emoji, titulo, ayuda, children, onGuardar, ocupado, sucio, msj }: {
  id: IdBloque; emoji: string; titulo: string; ayuda?: string; children: React.ReactNode;
  onGuardar?: () => void; ocupado?: boolean; sucio?: boolean; msj?: Respuesta;
}) {
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-bloque={id} data-respuestas={msj?.n ?? 0}>
      <div>
        <p className="titulo text-2xl">{emoji} {titulo}</p>
        {ayuda && <p className="texto-suave">{ayuda}</p>}
      </div>
      {children}
      {onGuardar && (
        <div className="space-y-3">
          {msj?.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
          {msj?.ok && !sucio && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="boton boton-principal" disabled={ocupado || !sucio} onClick={onGuardar}>✅ Guardar</button>
            {sucio && <span className="pildora" data-sin-guardar>• Cambios sin guardar</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export function Ajustes({ inicial, puedeEditar }: { inicial: Config; puedeEditar: boolean }) {
  const [c, setC] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [msj, setMsj] = useState<Partial<Record<IdBloque, Respuesta>>>({});
  const responder = (b: IdBloque, r: Omit<Respuesta, "n">) => setMsj((m) => ({ ...m, [b]: { ...r, n: (m[b]?.n ?? 0) + 1 } }));
  const [enCurso, setEnCurso] = useState<IdBloque | null>(null);
  const [, empezar] = useTransition();
  const set = <K extends Campo>(k: K, v: Config[K]) => setC((x) => ({ ...x, [k]: v }));
  const sucio = (b: IdBloque) => (BLOQUES[b] as Campo[]).some((k) => !igual(c[k], guardado[k]));
  const algoSucio = puedeEditar && (Object.keys(BLOQUES) as IdBloque[]).some(sucio);

  // Irse con cambios sin guardar: el navegador pregunta antes.
  useEffect(() => {
    if (!algoSucio) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [algoSucio]);

  const guardar = (b: IdBloque) => {
    const campos = BLOQUES[b] as Campo[];
    const mal = problema(c, campos);
    if (mal) { responder(b, { error: mal }); return; }
    setEnCurso(b);
    empezar(async () => {
      const datos = Object.fromEntries(campos.map((k) => [k, c[k]]));
      const r = await guardarConfiguracion(datos);
      setEnCurso(null);
      if (r.error) { responder(b, { error: r.error }); return; }
      setGuardado((g) => ({ ...g, ...datos }));
      responder(b, { ok: "Guardado ✅" });
    });
  };
  const props = (b: IdBloque) => puedeEditar
    ? { id: b, onGuardar: () => guardar(b), ocupado: enCurso !== null, sucio: sucio(b), msj: msj[b] }
    : { id: b };

  const num = (k: Campo, etiqueta: string, ayuda: string) => {
    const [min, max] = RANGOS[k] ?? [0, 999];
    const v = c[k] as unknown as number | "";
    return (
      <label className="block space-y-1"><span className="etiqueta">{etiqueta}</span>
        <input type="number" inputMode="numeric" min={min} max={max} className="campo" value={Number.isNaN(v) ? "" : v}
          onChange={(e) => set(k, (e.target.value === "" ? "" : Number(e.target.value)) as never)} />
        <span className="block text-sm texto-tenue">{ayuda} · de {min} a {max}</span></label>
    );
  };

  return (
    <fieldset disabled={!puedeEditar} className="space-y-4">
      {!puedeEditar && <p className="pildora">👀 Solo el dueño cambia la configuración.</p>}

      <Bloque emoji="🎨" titulo="Marca" ayuda="El nombre y los colores se ven en la página, en el panel y en la app." {...props("marca")}>
        <label className="block space-y-1"><span className="etiqueta">Nombre del gimnasio</span>
          <input className="campo" maxLength={60} value={c.nombre} onChange={(e) => set("nombre", e.target.value)} /></label>
        <div><p className="etiqueta mb-2">Fondo</p><div className="flex flex-wrap gap-2">
          {FONDOS.map((f) => <button key={f} type="button" aria-label={f} aria-pressed={c.color_fondo === f} onClick={() => set("color_fondo", f)} className="size-11 rounded-xl border-2" style={{ background: f, borderColor: c.color_fondo === f ? "var(--acento)" : "var(--borde)" }} />)}
          <input type="color" aria-label="Otro fondo" value={c.color_fondo} onChange={(e) => set("color_fondo", e.target.value)} className="size-11 rounded-xl bg-transparent" />
        </div></div>
        <div><p className="etiqueta mb-2">Color principal (botones)</p><div className="flex flex-wrap gap-2">
          {ACENTOS.map((a) => <button key={a} type="button" aria-label={a} aria-pressed={c.color_acento === a} onClick={() => set("color_acento", a)} className="size-11 rounded-xl border-2" style={{ background: a, borderColor: c.color_acento === a ? "var(--texto)" : "transparent" }} />)}
          <input type="color" aria-label="Otro color" value={c.color_acento} onChange={(e) => set("color_acento", e.target.value)} className="size-11 rounded-xl bg-transparent" />
        </div></div>
        <div {...propsMarca(c)} className="rounded-[var(--radio)] p-5 border border-[var(--borde)]">
          <p className="titulo text-2xl" style={{ color: "var(--texto)" }}>{c.nombre || "Tu gimnasio"}</p>
          <p className="texto-suave">Así se ve.</p>
          <span className="boton boton-principal mt-3">🔥 Botón principal</span>
        </div>
      </Bloque>

      <Bloque emoji="💵" titulo="Qué cobrás" ayuda="Lo que no cobrás no aparece al vender. Tiene que quedar al menos uno." {...props("cobro")}>
        <div className="divide-y divide-[var(--borde)]">
          <Interruptor etiqueta="🏷️ Membresía mensual" ayuda="El socio paga el mes y entra todos los días." checked={c.cobra_membresia} onChange={(e) => set("cobra_membresia", e.target.checked)} />
          <Interruptor etiqueta="🎫 Pase diario" ayuda="Paga y entra ese día." checked={c.cobra_pase} onChange={(e) => set("cobra_pase", e.target.checked)} />
          <Interruptor etiqueta="🎟️ Packs de clases" ayuda="Compra una cantidad de clases y las va usando." checked={c.cobra_pack} onChange={(e) => set("cobra_pack", e.target.checked)} />
        </div>
      </Bloque>

      <Bloque emoji="🗓️" titulo="Clases" ayuda="Sin clases, no aparece nada de clases en ningún panel ni en la app." {...props("clases")}>
        <div className="grid sm:grid-cols-3 gap-2">
          {[["reserva", "📝 Con reserva y cupo"], ["sin_reserva", "🚶 Sin reserva"], ["ninguno", "🚫 No damos clases"]].map(([v, t]) => (
            <button key={v} type="button" aria-pressed={c.modo_clases === v} onClick={() => set("modo_clases", v)} className={`boton ${c.modo_clases === v ? "!border-[var(--acento)]" : "opacity-70"}`}>{t}</button>
          ))}
        </div>
        {c.modo_clases === "reserva" && <div className="grid sm:grid-cols-2 gap-3">
          {num("reserva_dias_anticipacion", "Se reserva con hasta (días)", "Cuántos días antes se abre la reserva")}
          {num("cancelacion_horas_limite", "Cancelar hasta (horas antes)", "Después de eso la reserva cuenta igual")}
        </div>}
      </Bloque>

      <Bloque emoji="📏" titulo="Reglas" {...props("reglas")}>
        <div className="grid sm:grid-cols-2 gap-3">
          {num("tolerancia_dias", "Días de gracia al vencer", "Puede entrar unos días más mientras paga")}
          {num("dias_aviso", "Avisar que vence (días antes)", "Aparece en amarillo en la entrada")}
          {num("descuento_max_recepcion", "Descuento máximo de la recepción (%)", "Más que eso lo autoriza el dueño")}
          {num("retencion_dias_ausencia", "“No viene” después de (días)", "Para la lista de retención")}
        </div>
      </Bloque>

      <Bloque emoji="🏦" titulo="Transferencias" ayuda="Lo que ve el socio para pagarte por transferencia." {...props("transferencias")}>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="space-y-1"><span className="etiqueta">Alias</span>
            <input className="campo" maxLength={20} autoCapitalize="none" spellCheck={false} value={c.alias_transferencia ?? ""} onChange={(e) => set("alias_transferencia", e.target.value)} />
            <span className="block text-sm texto-tenue">6 a 20: letras, números, puntos o guiones</span></label>
          <label className="space-y-1"><span className="etiqueta">CBU / CVU</span>
            <input className="campo" inputMode="numeric" maxLength={30} value={c.cbu ?? ""} onChange={(e) => set("cbu", e.target.value)} />
            <span className="block text-sm texto-tenue">22 números</span></label>
          <label className="space-y-1"><span className="etiqueta">Titular</span>
            <input className="campo" maxLength={80} value={c.titular_cuenta ?? ""} onChange={(e) => set("titular_cuenta", e.target.value)} /></label>
        </div>
      </Bloque>

      <Bloque emoji="🧩" titulo="Secciones" ayuda="Apagá lo que no usás: desaparece de todos los paneles." {...props("secciones")}>
        <div className="grid sm:grid-cols-2 gap-x-6 divide-y divide-[var(--borde)] sm:divide-y-0">
          {SECCIONES.map(([k, t, ayuda]) => (
            <Interruptor key={k} etiqueta={t} ayuda={ayuda} checked={!c.secciones_apagadas.includes(k)}
              onChange={(e) => set("secciones_apagadas", e.target.checked ? c.secciones_apagadas.filter((x) => x !== k) : [...c.secciones_apagadas, k])} />
          ))}
        </div>
      </Bloque>
    </fieldset>
  );
}
