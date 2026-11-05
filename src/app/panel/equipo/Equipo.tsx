"use client";
import { useActionState, useState, useTransition } from "react";
import { AccesoPersona } from "@/components/cuentas/AccesoPersona";
import { NOMBRE_ROL, type Rol } from "@/lib/panel/secciones";
import { agregarPersona, editarPersona, type Resultado } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

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
  // AUD-12: hacer dueño a alguien le da la plata y la configuración: se confirma en pantalla.
  const [hacerDueno, setHacerDueno] = useState<Miembro | null>(null);
  const cambiarRol = (m: Miembro, rol: string) => {
    if (rol === "dueno") { setHacerDueno(m); return; }
    empezar(async () => { const r = await editarPersona(m.equipo_id, m.nombre, rol, m.sede_id, m.activo); setError(r.error ?? null); });
  };
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
                <select aria-label={`Rol de ${m.nombre}`} className="campo !w-auto" value={m.rol} disabled={ocupado}
                  onChange={(e) => cambiarRol(m, e.target.value)}>
                  {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
                </select>
                <button type="button" className="boton boton-chico texto-suave" disabled={ocupado}
                  onClick={() => empezar(async () => { const r = await editarPersona(m.equipo_id, m.nombre, m.rol, m.sede_id, !m.activo); setError(r.error ?? null); })}>
                  {m.activo ? "Sacar acceso" : "Devolver acceso"}
                </button>
              </div>
            )}
            {hacerDueno?.equipo_id === m.equipo_id && (
              <div className="basis-full flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar" data-confirmar-dueno>
                <span className="texto-suave">¿Hacer dueño a {m.nombre}? Va a ver la plata y poder cambiar la configuración y el equipo.</span>
                <button type="button" className="boton boton-chico boton-peligro" disabled={ocupado}
                  onClick={() => empezar(async () => { const r = await editarPersona(m.equipo_id, m.nombre, "dueno", m.sede_id, m.activo); setError(r.error ?? null); setHacerDueno(null); })}>Sí, hacerlo dueño</button>
                <button type="button" className="boton-texto texto-suave" onClick={() => setHacerDueno(null)}>Cancelar</button>
              </div>
            )}
            {puedeEditar && !m.soy_yo && m.activo && (
              // A otro dueño no se le cambia la contraseña (eso lo hace BRIK); acceso sí se le puede dar.
              <AccesoPersona equipoId={m.equipo_id} nombre={m.nombre} tieneCuenta={m.tiene_acceso} puedeNuevaClave={m.rol !== "dueno"} />
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
            <Mensaje tipo="exito" className="sm:col-span-2">
              <p>{estado.aviso}</p>
              {estado.contrasena && <p className="mt-2 text-[var(--texto)]">📧 <strong className="break-all">{estado.email}</strong> · 🔑 <strong className="numero text-2xl select-all">{estado.contrasena}</strong></p>}
            </Mensaje>
          )}
          <div className="sm:col-span-2"><button type="submit" disabled={guardando} className="boton boton-principal">{guardando ? "Sumando…" : "➕ Sumar al equipo"}</button></div>
        </form>
      )}
    </div>
  );
}
