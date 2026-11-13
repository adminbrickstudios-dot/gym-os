"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { useConfirmar } from "@/components/ui/useConfirmar";
import { cuitConGuiones, errorDeCuit } from "@/lib/admin/cuit";
import { cerrarSesionesGimnasio, guardarDatosFiscales } from "../acciones";

const Alerta = ({ m }: { m: string }) => (m ? <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3">{m}</p> : null);

export type DatosFiscales = { cuit: string | null; razon_social: string | null; actualizado_en: string | null; actualizado_por: string | null };

/** F2.10 · CUIT y razón social para la factura de BRIK. Solo el rol Principal y Ventas guardan (la base lo exige); el resto lo ve. */
export function DatosFiscalesGimnasio({ gimnasioId, datos, cuando }: { gimnasioId: string; datos: DatosFiscales; cuando: string }) {
  const router = useRouter();
  const [cuit, setCuit] = useState(datos.cuit ? cuitConGuiones(datos.cuit) : "");
  const [razon, setRazon] = useState(datos.razon_social ?? "");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const avisoCuit = errorDeCuit(cuit);
  const igual = cuit.replace(/\D/g, "") === (datos.cuit ?? "") && razon.trim() === (datos.razon_social ?? "");
  return (
    <div className="space-y-3" data-datos-fiscales>
      <p className="texto-suave">Para la factura que BRIK le hace a este gimnasio. El dueño no lo ve.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 block"><span className="etiqueta">CUIT</span>
          <input className="campo" inputMode="numeric" autoComplete="off" placeholder="30-12345678-9" value={cuit} maxLength={13} data-cuit
            aria-invalid={avisoCuit ? true : undefined} onChange={(e) => { setCuit(e.target.value); setAviso(""); }} /></label>
        <label className="space-y-1 block"><span className="etiqueta">Razón social</span>
          <input className="campo" value={razon} maxLength={120} data-razon-social onChange={(e) => { setRazon(e.target.value); setAviso(""); }} /></label>
      </div>
      {avisoCuit && <p className="texto-suave text-sm" data-cuit-aviso>{avisoCuit}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <BotonAccion className="boton" disabled={igual || !!avisoCuit} data-guardar-fiscales onClick={async () => {
          const r = await guardarDatosFiscales(gimnasioId, cuit, razon);
          if (r.error) { setError(r.error); setAviso(""); return; }
          setError("");
          setAviso(r.repetido ? "Guardado. Ojo: otro gimnasio tiene este mismo CUIT." : "Guardado.");
          router.refresh();
        }}>Guardar</BotonAccion>
        {aviso && <span className="texto-suave" role="status" data-fiscales-guardado>{aviso}</span>}
      </div>
      <Alerta m={error} />
      {datos.actualizado_en && <p className="texto-tenue text-sm" data-fiscales-quien>Último cambio: {cuando}{datos.actualizado_por ? ` · ${datos.actualizado_por}` : ""}. Cada cambio queda en el registro de BRIK.</p>}
    </div>
  );
}

export type SesionesPersona = { equipo_id: string; nombre: string; rol: string; email: string | null; es_brik: boolean; sesiones: number; ultima_actividad: string | null; equipos: string[] };
export type SesionesGimnasio = { personas: SesionesPersona[]; total: number };
/** Lo que la ficha le pasa a la pantalla: la fecha y el rol ya escritos (una función del servidor no viaja al navegador). */
export type SesionesVista = { total: number; personas: (SesionesPersona & { rol_nombre: string; ultima: string })[] };

/** F2.11 · Sesiones abiertas del equipo y "Cerrar todas". Solo el rol Principal de BRIK (la base lo exige y lo registra). */
export function SesionesAbiertas({ gimnasioId, nombre, datos }: { gimnasioId: string; nombre: string; datos: SesionesVista }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  const [confirmar, dialogo] = useConfirmar();
  return (
    <div className="space-y-3" data-sesiones-gimnasio>
      {dialogo}
      <p className="texto-suave">Para cuando alguien del equipo se va mal. Cerrar las sesiones obliga a volver a entrar con la contraseña; la pantalla que ya tiene abierta puede seguir andando hasta una hora. Para frenarlo ya mismo, desactivalo en “Equipo y claves”.</p>
      {datos.personas.length === 0 ? <p className="texto-tenue">Este gimnasio no tiene personas con acceso.</p> : (
        <ul className="space-y-2">
          {datos.personas.map((p) => (
            <li key={p.equipo_id} className="tarjeta p-3 text-sm" data-sesion-persona data-sesiones={p.sesiones}>
              <span className="font-semibold">{p.nombre}</span> · {p.rol_nombre}{p.email ? ` · ${p.email}` : ""}
              <span className="block texto-suave">
                {p.sesiones === 0 ? "Sin sesiones abiertas" : `${p.sesiones} ${p.sesiones === 1 ? "sesión abierta" : "sesiones abiertas"} · última actividad ${p.ultima}`}
                {p.es_brik ? " · cuenta de BRIK (no se cierra desde acá)" : ""}
              </span>
              {p.equipos.length > 0 && <span className="block texto-tenue break-words">{p.equipos.join(" · ")}</span>}
            </li>
          ))}
        </ul>
      )}
      <label className="space-y-1 block"><span className="etiqueta">Motivo (queda registrado)</span>
        <input className="campo" value={motivo} maxLength={300} data-motivo-sesiones onChange={(e) => setMotivo(e.target.value)} /></label>
      <BotonAccion className="boton" data-cerrar-sesiones disabled={motivo.trim().length < 5 || datos.total === 0} onClick={async () => {
        if (!(await confirmar(`Vas a cerrar las ${datos.total} sesiones abiertas del equipo de ${nombre}. Van a tener que volver a entrar.`, { boton: "Cerrar todas", peligro: true }))) return;
        const r = await cerrarSesionesGimnasio(gimnasioId, motivo);
        if (r.error) { setError(r.error); setHecho(""); return; }
        setError(""); setMotivo(""); setHecho(`Se cerraron ${r.sesiones} ${r.sesiones === 1 ? "sesión" : "sesiones"} de ${r.personas} ${r.personas === 1 ? "persona" : "personas"}. Quedó en el registro.`);
        router.refresh();
      }}>Cerrar todas las sesiones</BotonAccion>
      {datos.total === 0 && <p className="texto-tenue text-sm">No hay sesiones abiertas para cerrar.</p>}
      {hecho && <p className="texto-suave" role="status" data-sesiones-cerradas>{hecho}</p>}
      <Alerta m={error} />
    </div>
  );
}
