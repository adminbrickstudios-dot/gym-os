"use client";
import { useActionState, useState, useTransition } from "react";
import { NOMBRE_ROL, type Rol } from "@/lib/panel/secciones";
import { agregarPersona, editarPersona, type Resultado } from "./acciones";

export type Miembro = { equipo_id: string; nombre: string; rol: Rol; sede_id: string | null; sede: string | null; activo: boolean; tiene_acceso: boolean; soy_yo: boolean };
const EMOJI: Record<Rol, string> = { dueno: "👑", encargado: "🧭", recepcion: "🛎️", profe: "💪" };
const QUE_HACE: Record<Rol, string> = {
  dueno: "Todo, incluida la plata y la configuración",
  encargado: "Todo menos configuración y equipo",
  recepcion: "Entrada, socios, vender y caja (sin ver lo esperado)",
  profe: "Sus clases y el presente",
};

export function Equipo({ miembros, sedes, puedeEditar }: { miembros: Miembro[]; sedes: { id: string; nombre: string }[]; puedeEditar: boolean }) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(agregarPersona, {});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="space-y-10">
      <ul className="space-y-2">
        {miembros.map((m) => (
          <li key={m.equipo_id} className={`tarjeta flex flex-wrap items-center gap-4 px-4 py-4 ${m.activo ? "" : "opacity-50"}`}>
            <span className="icono" aria-hidden>{EMOJI[m.rol]}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-lg">{m.nombre}{m.soy_yo && <span className="texto-tenue font-normal"> · vos</span>}</span>
              <span className="block texto-suave text-sm">{NOMBRE_ROL[m.rol]}{m.sede ? ` · ${m.sede}` : ""}{m.tiene_acceso ? "" : " · sin acceso al sistema"}</span>
            </span>
            {puedeEditar && !m.soy_yo && (
              <div className="flex gap-2">
                <select aria-label={`Rol de ${m.nombre}`} className="campo !min-h-10 !w-auto" value={m.rol} disabled={ocupado}
                  onChange={(e) => empezar(async () => { const r = await editarPersona(m.equipo_id, m.nombre, e.target.value, m.sede_id, m.activo); setError(r.error ?? null); })}>
                  {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
                </select>
                <button type="button" className="boton !min-h-10 texto-suave" disabled={ocupado}
                  onClick={() => empezar(async () => { const r = await editarPersona(m.equipo_id, m.nombre, m.rol, m.sede_id, !m.activo); setError(r.error ?? null); })}>
                  {m.activo ? "Sacar acceso" : "Devolver acceso"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}

      {puedeEditar && (
        <form action={accion} className="tarjeta p-5 grid sm:grid-cols-2 gap-3">
          <p className="titulo text-2xl sm:col-span-2">➕ Sumar a alguien</p>
          <label className="space-y-1"><span className="etiqueta">Nombre</span><input name="nombre" required className="campo" /></label>
          <label className="space-y-1"><span className="etiqueta">Mail (para que entre al sistema)</span><input name="email" type="email" className="campo" placeholder="Vacío: solo figura en la grilla" /></label>
          <label className="space-y-1"><span className="etiqueta">Rol</span>
            <select name="rol" className="campo" defaultValue="recepcion">{(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => <option key={r} value={r}>{EMOJI[r]} {NOMBRE_ROL[r]} — {QUE_HACE[r]}</option>)}</select></label>
          {sedes.length > 1 && <label className="space-y-1"><span className="etiqueta">Sede</span>
            <select name="sede" className="campo"><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>}
          {estado.error && <p role="alert" className="pildora pildora-rojo sm:col-span-2 !rounded-2xl !px-4 !py-3">⚠️ {estado.error}</p>}
          {estado.aviso && (
            <div role="status" className="sm:col-span-2 tarjeta !bg-[var(--tarjeta-alta)] p-4">
              <p>✅ {estado.aviso}</p>
              {estado.contrasena && <p className="mt-2">📧 <strong>{estado.email}</strong> · 🔑 <strong className="numero text-2xl select-all">{estado.contrasena}</strong></p>}
            </div>
          )}
          <div className="sm:col-span-2"><button type="submit" disabled={guardando} className="boton boton-principal">{guardando ? "Sumando…" : "➕ Sumar al equipo"}</button></div>
        </form>
      )}
    </div>
  );
}
