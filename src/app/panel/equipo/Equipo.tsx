"use client";
import { CampoContrasena } from "@/components/cuentas/CampoContrasena";
import { useActionState, useState, useTransition } from "react";
import { AccesoPersona } from "@/components/cuentas/AccesoPersona";
import { NOMBRE_ROL, type Rol } from "@/lib/panel/secciones";
import { agregarPersona, editarPersona, nuevaClaveEquipo, type Resultado } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { darDeBajaPersona } from "../seguridad-acciones";
import { Icono } from "@/components/ui/Icono";

export type Miembro = { equipo_id: string; nombre: string; rol: Rol; sede_id: string | null; sede: string | null; activo: boolean; tiene_acceso: boolean; soy_yo: boolean };
const EMOJI: Record<Rol, string> = { dueno: "llave", encargado: "estrella", recepcion: "persona", profe: "pesa" };
/** Qué cambia al pasar de un rol a otro, en palabras (la confirmación lo dice antes de tocar nada). */
const VE_PLATA: Record<Rol, boolean> = { dueno: true, encargado: true, recepcion: false, profe: false };
function queCambia(de: Rol, a: Rol): string {
  const partes: string[] = [];
  if (!VE_PLATA[de] && VE_PLATA[a]) partes.push("va a ver la plata");
  if (VE_PLATA[de] && !VE_PLATA[a]) partes.push("deja de ver la plata");
  if (a === "dueno") partes.push("va a poder cambiar la configuración y el equipo");
  if (de === "dueno" && a !== "dueno") partes.push("pierde la configuración y el equipo");
  if (a === "recepcion" || a === "profe") partes.push(`pasa a: ${QUE_HACE[a].toLowerCase()}`);
  return partes.length ? `${partes.join("; ")}.` : "Cambia lo que ve y lo que puede hacer.";
}
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
  // Cualquier cambio de rol se confirma (un toque en el menú no alcanza para darle la plata a la recepción).
  const [cambioRol, setCambioRol] = useState<{ m: Miembro; rol: Rol } | null>(null);
  // VD-42: "Dar de baja" corta todo de una vez; se confirma en pantalla diciendo qué pasa.
  const [baja, setBaja] = useState<Miembro | null>(null);
  const [motivoBaja, setMotivoBaja] = useState("");
  const [avisoBaja, setAvisoBaja] = useState<string | null>(null);
  const cambiarRol = (m: Miembro, rol: string) => { if (rol !== m.rol) setCambioRol({ m, rol: rol as Rol }); };
  return (
    <div className="space-y-10">
      <ul className="space-y-2">
        {miembros.map((m) => (
          <li key={m.equipo_id} className={`tarjeta flex flex-wrap items-center gap-4 px-4 py-4 ${m.activo ? "" : "opacity-50"}`}>
            <span className="icono" aria-hidden><Icono nombre={EMOJI[m.rol]} /></span>
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
                {m.activo && (
                  <button type="button" className="boton boton-chico boton-peligro" disabled={ocupado} data-dar-de-baja={m.equipo_id}
                    onClick={() => { setBaja(m); setMotivoBaja(""); setAvisoBaja(null); }}>
                    Dar de baja
                  </button>
                )}
              </div>
            )}
            {baja?.equipo_id === m.equipo_id && (
              <div className="basis-full space-y-2" role="group" aria-label="Confirmar la baja" data-confirmar-baja>
                <p className="texto-suave">¿Dar de baja a {m.nombre}? Deja de entrar al sistema ahora mismo: se cierran sus sesiones, se borra su PIN y se cierra su turno de caja si tiene uno abierto. Su historial queda.</p>
                <input className="campo" aria-label="Motivo de la baja (opcional)" placeholder="Motivo (opcional)" maxLength={200} value={motivoBaja} onChange={(e) => setMotivoBaja(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2">
                  <BotonAccion className="boton boton-chico boton-peligro" ocupadoTexto="Dando de baja…" data-confirmar-baja-si
                    onClick={async () => {
                      const r = await darDeBajaPersona(m.equipo_id, motivoBaja);
                      setError(r.error ?? null); setAvisoBaja(r.aviso ?? null);
                      if (!r.error) setBaja(null);
                    }}>Sí, dar de baja</BotonAccion>
                  <button type="button" className="boton-texto texto-suave" onClick={() => setBaja(null)}>Cancelar</button>
                </div>
              </div>
            )}
            {cambioRol?.m.equipo_id === m.equipo_id && (
              <div className="basis-full flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar el cambio de rol" data-confirmar-rol={cambioRol.rol} {...(cambioRol.rol === "dueno" ? { "data-confirmar-dueno": "" } : {})}>
                <span className="texto-suave">¿Pasar a {m.nombre} de {NOMBRE_ROL[m.rol]} a {NOMBRE_ROL[cambioRol.rol]}? {queCambia(m.rol, cambioRol.rol)}</span>
                <button type="button" className={`boton boton-chico ${cambioRol.rol === "dueno" || (VE_PLATA[cambioRol.rol] && !VE_PLATA[m.rol]) ? "boton-peligro" : ""}`} disabled={ocupado} data-confirmar-rol-si
                  onClick={() => empezar(async () => { const r = await editarPersona(m.equipo_id, m.nombre, cambioRol.rol, m.sede_id, m.activo); setError(r.error ?? null); setCambioRol(null); })}>
                  {cambioRol.rol === "dueno" ? "Sí, hacerlo dueño" : `Sí, pasarlo a ${NOMBRE_ROL[cambioRol.rol]}`}
                </button>
                <button type="button" className="boton-texto texto-suave" onClick={() => setCambioRol(null)}>Cancelar</button>
              </div>
            )}
            {puedeEditar && !m.soy_yo && m.activo && (
              // A otro dueño no se le cambia la contraseña (eso lo hace BRIK); acceso sí se le puede dar.
              <AccesoPersona equipoId={m.equipo_id} nombre={m.nombre} tieneCuenta={m.tiene_acceso} puedeNuevaClave={m.rol !== "dueno"} accionClave={nuevaClaveEquipo} />
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      {avisoBaja && <Mensaje tipo="exito"><span data-baja-hecha>{avisoBaja}</span></Mensaje>}

      {puedeEditar && (
        <form action={accion} className="tarjeta p-5 grid sm:grid-cols-2 gap-3">
          <p className="titulo text-2xl sm:col-span-2"><Icono nombre="mas" /> Sumar a alguien</p>
          <label className="space-y-1"><span className="etiqueta">Nombre</span><input name="nombre" required className="campo" defaultValue={estado.valores?.nombre} /></label>
          <label className="space-y-1"><span className="etiqueta">Mail (para que entre al sistema)</span><input name="email" type="email" className="campo" defaultValue={estado.valores?.email} placeholder="Vacío: solo figura en la grilla" /></label>
          <label className="space-y-1"><span className="etiqueta">Contraseña</span><CampoContrasena /></label>
          <label className="space-y-1"><span className="etiqueta">Rol</span>
            <select name="rol" className="campo" defaultValue={estado.valores?.rol ?? "recepcion"}>{(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]} — {QUE_HACE[r]}</option>)}</select></label>
          {sedes.length > 1 && <label className="space-y-1"><span className="etiqueta">Sede</span>
            <select name="sede" className="campo"><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>}
          {estado.error && <p role="alert" className="pildora pildora-rojo sm:col-span-2 !rounded-[var(--radio)] !px-4 !py-3"><Icono nombre="alerta" /> {estado.error}</p>}
          {estado.aviso && (
            <Mensaje tipo="exito" className="sm:col-span-2">
              <p>{estado.aviso}</p>
              {estado.contrasena && <p className="mt-2 text-[var(--texto)]"><Icono nombre="mail" /> <strong className="break-all">{estado.email}</strong> · <Icono nombre="llave" /> <strong className="numero text-2xl select-all">{estado.contrasena}</strong></p>}
            </Mensaje>
          )}
          <div className="sm:col-span-2"><button type="submit" disabled={guardando} className="boton boton-principal">{guardando ? "Sumando…" : "Sumar al equipo"}</button></div>
        </form>
      )}
    </div>
  );
}
