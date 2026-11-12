"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { formatearNumero } from "@/lib/formato";
import { cancelarMantenimiento, guardarLinkPago, prenderFuncion, programarMantenimiento } from "./acciones";

export type DatosPlataforma = {
  estado: { migraciones: number; ultima_migracion: string | null; tamano_base_mb: number };
  deploy: { commit: string | null; region: string | null; entorno: string | null };
  uso: { gimnasio_id: string; nombre: string; socios: number; fotos: number; ingresos_30_dias: number; sedes: number }[];
  mantenimientos: { id: string; desde: string; hasta: string; texto: string }[];
  funciones: { clave: string; gimnasio_id: string; gimnasio: string }[];
  linkPago: string | null;
};
const cuando = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
const Alerta = ({ m }: { m: string }) => (m ? <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3">{m}</p> : null);

/** SA-7, SA-8 y SA-9: estado de la plataforma, uso por gimnasio, aviso de mantenimiento, link de pago y funciones a prueba. */
export function Plataforma({ d }: { d: DatosPlataforma }) {
  const router = useRouter();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState(d.linkPago ?? "");
  const [clave, setClave] = useState("");
  const [gim, setGim] = useState("");
  const [error, setError] = useState("");
  const hecho = async (f: () => Promise<{ error?: string }>) => { const r = await f(); if (r.error) { setError(r.error); return; } setError(""); router.refresh(); };
  return (
    <section className="space-y-6" data-plataforma>
      <div className="space-y-2">
        <p className="titulo-grupo">Estado de la plataforma</p>
        <ul className="texto-suave space-y-1">
          <li>Migraciones aplicadas: {d.estado.migraciones}. Última: {d.estado.ultima_migracion ?? "—"}.</li>
          <li>Base de datos: {formatearNumero(d.estado.tamano_base_mb)} MB.</li>
          <li>Último deploy: {d.deploy.commit ? d.deploy.commit.slice(0, 7) : "sin dato (solo se ve en producción)"}{d.deploy.region ? ` · región ${d.deploy.region}` : ""}{d.deploy.entorno ? ` · ${d.deploy.entorno}` : ""}.</li>
        </ul>
      </div>

      <div className="space-y-2" data-uso-gimnasios>
        <p className="titulo-grupo">Uso por gimnasio</p>
        {d.uso.length === 0 ? <p className="texto-tenue">Todavía no hay gimnasios.</p> : (
          <ul className="space-y-1">
            {d.uso.map((u) => (
              <li key={u.gimnasio_id} className="tarjeta p-3 text-sm flex flex-wrap gap-x-4">
                <span className="font-semibold flex-1 min-w-[10rem]">{u.nombre}</span>
                <span>{formatearNumero(u.socios)} socios</span><span>{formatearNumero(u.fotos)} fotos</span>
                <span>{formatearNumero(u.ingresos_30_dias)} entradas en 30 días</span><span>{u.sedes} {u.sedes === 1 ? "sede" : "sedes"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2" data-mantenimiento>
        <p className="titulo-grupo">Aviso de mantenimiento</p>
        <p className="texto-suave">Una franja en los paneles con la hora, desde 48 horas antes.</p>
        {d.mantenimientos.map((m) => (
          <div key={m.id} className="tarjeta p-3 flex flex-wrap items-center gap-3">
            <span className="flex-1">{m.texto} · {cuando(m.desde)} a {cuando(m.hasta)}</span>
            <BotonAccion className="boton texto-suave" onClick={() => hecho(() => cancelarMantenimiento(m.id))}>Cancelar</BotonAccion>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-3 items-end">
          <label className="space-y-1"><span className="etiqueta">Desde</span><input className="campo" type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="space-y-1"><span className="etiqueta">Hasta</span><input className="campo" type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <label className="space-y-1"><span className="etiqueta">Qué va a pasar</span><input className="campo" value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} placeholder="Mantenimiento de la base" /></label>
          <div className="sm:col-span-3"><BotonAccion className="boton" disabled={!desde || !hasta || texto.trim().length < 5}
            onClick={() => hecho(() => programarMantenimiento(new Date(desde).toISOString(), new Date(hasta).toISOString(), texto))}>Programar el aviso</BotonAccion></div>
        </div>
      </div>

      <div className="space-y-2" data-link-pago>
        <p className="titulo-grupo">Link de pago de BRIK</p>
        <p className="texto-suave">Va en el recordatorio del abono por WhatsApp. Tiene que empezar con https://</p>
        <div className="flex flex-wrap gap-2 items-end">
          <input className="campo flex-1 min-w-[14rem]" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link de pago" />
          <BotonAccion className="boton" onClick={() => hecho(() => guardarLinkPago(link))}>Guardar</BotonAccion>
        </div>
      </div>

      <div className="space-y-2" data-funciones-prueba>
        <p className="titulo-grupo">Funciones a prueba</p>
        <p className="texto-suave">Prender una función nueva solo en un gimnasio, antes de dársela a todos. La función de la app pregunta con <code>funcion_prendida</code>.</p>
        {d.funciones.map((f) => (
          <div key={`${f.clave}-${f.gimnasio_id}`} className="tarjeta p-3 flex flex-wrap items-center gap-3"><span className="flex-1">{f.clave} en {f.gimnasio}</span>
            <BotonAccion className="boton texto-suave" onClick={() => hecho(() => prenderFuncion(f.gimnasio_id, f.clave, false))}>Apagar</BotonAccion></div>
        ))}
        <div className="grid gap-2 sm:grid-cols-3 items-end">
          <label className="space-y-1"><span className="etiqueta">Clave de la función</span><input className="campo" value={clave} onChange={(e) => setClave(e.target.value.toLowerCase())} placeholder="tv_nueva" /></label>
          <label className="space-y-1"><span className="etiqueta">Gimnasio</span>
            <select className="campo" value={gim} onChange={(e) => setGim(e.target.value)}><option value="">Elegí uno</option>{d.uso.map((u) => <option key={u.gimnasio_id} value={u.gimnasio_id}>{u.nombre}</option>)}</select></label>
          <BotonAccion className="boton" disabled={!clave || !gim} onClick={() => hecho(() => prenderFuncion(gim, clave, true))}>Prender</BotonAccion>
        </div>
      </div>
      <Alerta m={error} />
    </section>
  );
}
