"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { cambiarDueno, cambiarSlug, guardarFuncion, guardarModulos } from "../acciones";

const NOMBRE_SECCION: Record<string, string> = {
  entrada: "Entrada", clases: "Clases", vencen_hoy: "Vencen hoy", socios: "Socios", retencion: "Retención", rutinas: "Rutinas",
  caja: "Caja", vender: "Vender", resultado: "Resultado", transferencias: "Transferencias", pt: "Turnos de entrenador",
};
const Alerta = ({ m }: { m: string }) => (m ? <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3">{m}</p> : null);

/** Links por rol con botón de copiar (SA-3, pestaña Links). */
export function LinksPorRol({ links }: { links: { rol: string; nombre: string; url: string }[] }) {
  const [copiado, setCopiado] = useState("");
  if (links.length === 0) return <p className="texto-tenue">Este gimnasio todavía no tiene dirección.</p>;
  return (
    <ul className="space-y-2" data-links-por-rol>
      {links.map((l) => (
        <li key={l.rol} className="tarjeta p-3 flex flex-wrap items-center gap-3">
          <span className="w-24 font-semibold">{l.nombre}</span>
          <span className="min-w-0 flex-1 break-all texto-suave select-all">{l.url}</span>
          <button type="button" className="boton" onClick={async () => { try { await navigator.clipboard.writeText(l.url); setCopiado(l.rol); } catch { setCopiado(""); } }}>
            {copiado === l.rol ? "Copiado" : "Copiar"}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** El slug se cambia acá (cambia los links: el aviso va antes del botón). */
export function CambiarSlug({ gimnasioId, slug }: { gimnasioId: string; slug: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(slug);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2" data-cambiar-slug>
      <label className="space-y-1 block"><span className="etiqueta">Slug (identificador en los links)</span>
        <input className="campo" value={valor} maxLength={40} onChange={(e) => setValor(e.target.value.toLowerCase())} /></label>
      <p className="texto-suave text-sm">Si lo cambiás, cambian los links que ya le pasaste al gimnasio (el de la página y el de los QR impresos).</p>
      <BotonAccion className="boton" disabled={valor === slug || valor.length < 2} onClick={async () => {
        const r = await cambiarSlug(gimnasioId, valor);
        if (r.error) { setError(r.error); return; }
        setError(""); router.refresh();
      }}>Cambiar el slug</BotonAccion>
      <Alerta m={error} />
    </div>
  );
}

/** Funciones nuevas: arrancan apagadas en los gimnasios con datos reales; los demos las tienen prendidas (F9.2). */
export function FuncionesNuevas({ gimnasioId, restaurarCambios }: { gimnasioId: string; restaurarCambios: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div className="space-y-3" data-funciones-nuevas>
      <label className="tarjeta p-3 flex items-center gap-2">
        <input type="checkbox" defaultChecked={restaurarCambios} data-funcion="restaurar_cambios"
          onChange={async (e) => { const r = await guardarFuncion(gimnasioId, "restaurar_cambios", e.target.checked); setError(r.error ?? ""); router.refresh(); }} />
        <span>Restaurar cambios de Configuración (el dueño vuelve un dato al valor anterior)</span>
      </label>
      <Alerta m={error} />
    </div>
  );
}

/** Módulos: qué secciones tiene prendidas el gimnasio (SA-3, pestaña Módulos y límites). */
export function Modulos({ gimnasioId, validas, apagadas }: { gimnasioId: string; validas: string[]; apagadas: string[] }) {
  const router = useRouter();
  const [off, setOff] = useState<string[]>(apagadas);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);
  const cambio = off.length !== apagadas.length || off.some((s) => !apagadas.includes(s));
  return (
    <div className="space-y-3" data-modulos>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {validas.map((s) => (
          <label key={s} className="tarjeta p-3 flex items-center gap-2">
            <input type="checkbox" checked={!off.includes(s)} data-modulo={s}
              onChange={(e) => { setGuardado(false); setOff(e.target.checked ? off.filter((x) => x !== s) : [...off, s]); }} />
            <span>{NOMBRE_SECCION[s] ?? s}</span>
          </label>
        ))}
      </div>
      <p className="texto-suave text-sm">Lo que apagás deja de verse en todos los paneles de este gimnasio.</p>
      <BotonAccion className="boton" disabled={!cambio} onClick={async () => {
        const r = await guardarModulos(gimnasioId, off);
        if (r.error) { setError(r.error); return; }
        setError(""); setGuardado(true); router.refresh();
      }}>Guardar módulos</BotonAccion>
      {guardado && <p className="texto-suave text-sm">Guardado.</p>}
      <Alerta m={error} />
    </div>
  );
}

/** Cambiar quién es el dueño: el anterior pasa a encargado. */
export function CambiarDueno({ gimnasioId, candidatos }: { gimnasioId: string; candidatos: { equipo_id: string; nombre: string }[] }) {
  const router = useRouter();
  const [elegido, setElegido] = useState("");
  const [error, setError] = useState("");
  if (candidatos.length === 0) return null;
  return (
    <div className="tarjeta p-4 space-y-2" data-cambiar-dueno>
      <p className="font-semibold">Cambiar quién es el dueño</p>
      <p className="texto-suave text-sm">La persona elegida pasa a dueño. El dueño actual queda como encargado y no pierde el acceso.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <select className="campo flex-1 min-w-[12rem]" value={elegido} onChange={(e) => setElegido(e.target.value)} aria-label="Nuevo dueño">
          <option value="">Elegí a alguien del equipo</option>
          {candidatos.map((c) => <option key={c.equipo_id} value={c.equipo_id}>{c.nombre}</option>)}
        </select>
        <BotonAccion className="boton" disabled={!elegido} onClick={async () => {
          const r = await cambiarDueno(gimnasioId, elegido);
          if (r.error) { setError(r.error); return; }
          setError(""); setElegido(""); router.refresh();
        }}>Cambiar dueño</BotonAccion>
      </div>
      <Alerta m={error} />
    </div>
  );
}
