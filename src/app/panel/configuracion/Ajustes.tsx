"use client";
import { useState, useTransition } from "react";
import { propsMarca } from "@/lib/marca";
import { guardarConfiguracion } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

export type Config = {
  nombre: string; color_acento: string; color_fondo: string; cobra_membresia: boolean; cobra_pase: boolean; cobra_pack: boolean;
  modo_clases: string; tolerancia_dias: number; dias_aviso: number; secciones_apagadas: string[]; alias_transferencia: string | null;
  cbu: string | null; titular_cuenta: string | null; descuento_max_recepcion: number; retencion_dias_ausencia: number;
  reserva_dias_anticipacion: number; cancelacion_horas_limite: number;
};

const FONDOS = ["#14161b", "#101418", "#16121f", "#1a1512", "#0f1a14", "#faf7f0"];
const ACENTOS = ["#2fbf5b", "#f5c518", "#3b82f6", "#a78bfa", "#ef4444", "#f97316", "#14b8a6"];
const SECCIONES: [string, string][] = [["entrada", "🚪 Entrada"], ["vencen_hoy", "⏰ Vencen hoy"], ["socios", "👥 Socios"], ["retencion", "📉 Retención"],
  ["vender", "🛒 Vender"], ["caja", "💵 Caja"], ["transferencias", "🧾 Transferencias"]];

function Bloque({ emoji, titulo, ayuda, children, onGuardar, ocupado }: { emoji: string; titulo: string; ayuda?: string; children: React.ReactNode; onGuardar?: () => void; ocupado?: boolean }) {
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4">
      <div><p className="titulo text-2xl">{emoji} {titulo}</p>{ayuda && <p className="texto-suave">{ayuda}</p>}</div>
      {children}
      {onGuardar && <button type="button" className="boton boton-principal" disabled={ocupado} onClick={onGuardar}>✅ Guardar</button>}
    </section>
  );
}

function Interruptor({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`boton !justify-between w-full ${on ? "" : "opacity-60"}`}>
      <span>{children}</span>
      <span className="w-11 h-6 rounded-full relative transition-colors" style={{ background: on ? "var(--acento)" : "var(--borde)" }}>
        <span className="absolute top-0.5 size-5 rounded-full bg-white transition-all" style={{ left: on ? "1.375rem" : "0.125rem" }} />
      </span>
    </button>
  );
}

export function Ajustes({ inicial, puedeEditar }: { inicial: Config; puedeEditar: boolean }) {
  const [c, setC] = useState(inicial);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setC({ ...c, [k]: v });
  const guardar = (campos: (keyof Config)[]) => empezar(async () => {
    const r = await guardarConfiguracion(Object.fromEntries(campos.map((k) => [k, c[k]])));
    setMsj(r.error ? { error: r.error } : { ok: "Guardado ✅" });
  });
  const g = puedeEditar ? guardar : undefined;
  const num = (k: keyof Config, etiqueta: string, ayuda: string, min: number, max: number) => (
    <label className="block space-y-1"><span className="etiqueta">{etiqueta}</span>
      <input type="number" min={min} max={max} className="campo" value={c[k] as number} disabled={!puedeEditar} onChange={(e) => set(k, Number(e.target.value) as never)} />
      <span className="block text-sm texto-tenue">{ayuda}</span></label>
  );

  return (
    <fieldset disabled={!puedeEditar} className="space-y-4">
      {!puedeEditar && <p className="pildora">👀 Solo el dueño cambia la configuración.</p>}
      {(msj.ok || msj.error) && <Mensaje tipo={msj.error ? "error" : "exito"} className="sticky top-16 lg:top-4 z-10">{msj.error ?? msj.ok}</Mensaje>}

      <Bloque emoji="🎨" titulo="Marca" ayuda="El nombre y los colores se ven en la página, en el panel y en la app." onGuardar={g && (() => g(["nombre", "color_fondo", "color_acento"]))} ocupado={ocupado}>
        <label className="block space-y-1"><span className="etiqueta">Nombre del gimnasio</span><input className="campo" value={c.nombre} onChange={(e) => set("nombre", e.target.value)} /></label>
        <div><p className="etiqueta mb-2">Fondo</p><div className="flex flex-wrap gap-2">
          {FONDOS.map((f) => <button key={f} type="button" aria-label={f} aria-pressed={c.color_fondo === f} onClick={() => set("color_fondo", f)} className="size-11 rounded-xl border-2" style={{ background: f, borderColor: c.color_fondo === f ? "var(--acento)" : "var(--borde)" }} />)}
          <input type="color" aria-label="Otro fondo" value={c.color_fondo} onChange={(e) => set("color_fondo", e.target.value)} className="size-11 rounded-xl bg-transparent" />
        </div></div>
        <div><p className="etiqueta mb-2">Color principal (botones)</p><div className="flex flex-wrap gap-2">
          {ACENTOS.map((a) => <button key={a} type="button" aria-label={a} aria-pressed={c.color_acento === a} onClick={() => set("color_acento", a)} className="size-11 rounded-xl border-2" style={{ background: a, borderColor: c.color_acento === a ? "var(--texto)" : "transparent" }} />)}
          <input type="color" aria-label="Otro color" value={c.color_acento} onChange={(e) => set("color_acento", e.target.value)} className="size-11 rounded-xl bg-transparent" />
        </div></div>
        <div {...propsMarca(c)} className="rounded-[var(--radio)] p-5 border border-[var(--borde)]">
          <p className="titulo text-2xl" style={{ color: "var(--texto)" }}>{c.nombre}</p>
          <p className="texto-suave">Así se ve.</p>
          <span className="boton boton-principal mt-3">🔥 Botón principal</span>
        </div>
      </Bloque>

      <Bloque emoji="💵" titulo="Qué cobrás" ayuda="Lo que no cobrás no aparece al vender." onGuardar={g && (() => g(["cobra_membresia", "cobra_pase", "cobra_pack"]))} ocupado={ocupado}>
        <Interruptor on={c.cobra_membresia} onChange={(v) => set("cobra_membresia", v)}>🏷️ Membresía mensual</Interruptor>
        <Interruptor on={c.cobra_pase} onChange={(v) => set("cobra_pase", v)}>🎫 Pase diario</Interruptor>
        <Interruptor on={c.cobra_pack} onChange={(v) => set("cobra_pack", v)}>🎟️ Packs de clases</Interruptor>
      </Bloque>

      <Bloque emoji="🗓️" titulo="Clases" onGuardar={g && (() => g(["modo_clases", "reserva_dias_anticipacion", "cancelacion_horas_limite"]))} ocupado={ocupado}>
        <div className="grid sm:grid-cols-3 gap-2">
          {[["reserva", "📝 Con reserva y cupo"], ["sin_reserva", "🚶 Sin reserva"], ["ninguno", "🚫 No damos clases"]].map(([v, t]) => (
            <button key={v} type="button" aria-pressed={c.modo_clases === v} onClick={() => set("modo_clases", v)} className={`boton ${c.modo_clases === v ? "!border-[var(--acento)]" : "opacity-70"}`}>{t}</button>
          ))}
        </div>
        {c.modo_clases === "reserva" && <div className="grid sm:grid-cols-2 gap-3">
          {num("reserva_dias_anticipacion", "Se reserva con hasta (días)", "Cuántos días antes se abre la reserva", 0, 60)}
          {num("cancelacion_horas_limite", "Cancelar hasta (horas antes)", "Después de eso la reserva cuenta igual", 0, 72)}
        </div>}
      </Bloque>

      <Bloque emoji="📏" titulo="Reglas" onGuardar={g && (() => g(["tolerancia_dias", "dias_aviso", "descuento_max_recepcion", "retencion_dias_ausencia"]))} ocupado={ocupado}>
        <div className="grid sm:grid-cols-2 gap-3">
          {num("tolerancia_dias", "Días de gracia al vencer", "Puede entrar unos días más mientras paga", 0, 60)}
          {num("dias_aviso", "Avisar que vence (días antes)", "Aparece en amarillo en la entrada", 0, 30)}
          {num("descuento_max_recepcion", "Descuento máximo de la recepción (%)", "Más que eso lo autoriza el dueño", 0, 100)}
          {num("retencion_dias_ausencia", "\"No viene\" después de (días)", "Para la lista de retención", 3, 90)}
        </div>
      </Bloque>

      <Bloque emoji="🏦" titulo="Transferencias" ayuda="Lo que ve el socio para pagarte por transferencia." onGuardar={g && (() => g(["alias_transferencia", "cbu", "titular_cuenta"]))} ocupado={ocupado}>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="space-y-1"><span className="etiqueta">Alias</span><input className="campo" value={c.alias_transferencia ?? ""} onChange={(e) => set("alias_transferencia", e.target.value)} /></label>
          <label className="space-y-1"><span className="etiqueta">CBU / CVU</span><input className="campo" inputMode="numeric" value={c.cbu ?? ""} onChange={(e) => set("cbu", e.target.value)} /></label>
          <label className="space-y-1"><span className="etiqueta">Titular</span><input className="campo" value={c.titular_cuenta ?? ""} onChange={(e) => set("titular_cuenta", e.target.value)} /></label>
        </div>
      </Bloque>

      <Bloque emoji="🧩" titulo="Secciones" ayuda="Apagá lo que no usás: desaparece de todos los paneles." onGuardar={g && (() => g(["secciones_apagadas"]))} ocupado={ocupado}>
        <div className="grid sm:grid-cols-2 gap-2">
          {SECCIONES.map(([k, t]) => (
            <Interruptor key={k} on={!c.secciones_apagadas.includes(k)} onChange={(v) => set("secciones_apagadas", v ? c.secciones_apagadas.filter((x) => x !== k) : [...c.secciones_apagadas, k])}>{t}</Interruptor>
          ))}
        </div>
      </Bloque>
    </fieldset>
  );
}
