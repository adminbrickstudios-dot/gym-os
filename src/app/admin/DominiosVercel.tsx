"use client";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { conectarDominioVercel, verificarDominioEnVercel } from "./acciones";
import type { EstadoDominio } from "@/lib/admin/vercel-dominios";

const SEMAFORO = { pendiente: ["pildora-amarillo", "Pendiente"], verificado: ["pildora-verde", "Verificado"], error: ["pildora-rojo", "Error"] } as const;

/**
 * PLAT-05: conectar el dominio de la plataforma (y el propio de un gimnasio) por la API de Vercel: se agrega, se muestran los registros DNS
 * exactos, se verifica y se ve el estado en semáforo. Sin VERCEL_TOKEN queda bloqueado y dice qué cargar.
 */
export function DominiosVercel({ lista, faltan }: { lista: boolean; faltan: string[] }) {
  const [dominio, setDominio] = useState("");
  const [estado, setEstado] = useState<EstadoDominio | null>(null);
  const [error, setError] = useState("");
  const correr = async (f: (d: string) => ReturnType<typeof conectarDominioVercel>) => {
    const r = await f(dominio);
    if (r.error) { setError(r.error); return; }
    setError(""); setEstado(r.estado ?? null);
  };
  return (
    <section className="space-y-3" data-dominios-vercel data-lista={lista ? "si" : "no"}>
      <p className="titulo-grupo">Dominios (Vercel)</p>
      {!lista && (
        <p className="texto-suave" data-dominios-bloqueado>
          Todavía no se puede conectar un dominio desde acá: falta cargar {faltan.join(" y ")} en Vercel (Settings → Environment Variables) y redeployar. Se hace una sola vez, cuando esté comprado el dominio; los pasos exactos están arriba de PROGRESO.md.
        </p>
      )}
      <div className="flex flex-wrap gap-2 items-end">
        <label className="space-y-1 flex-1 min-w-[14rem]"><span className="etiqueta">Dominio (por ejemplo base.com.ar, app.base.com.ar o *.base.com.ar)</span>
          <input className="campo" value={dominio} onChange={(e) => setDominio(e.target.value)} disabled={!lista} /></label>
        <BotonAccion className="boton boton-principal" disabled={!lista || dominio.trim().length < 4} onClick={() => correr(conectarDominioVercel)}>Agregar a Vercel</BotonAccion>
        <BotonAccion className="boton" disabled={!lista || !estado} onClick={() => correr(verificarDominioEnVercel)}>Verificar</BotonAccion>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3">{error}</p>}
      {estado && (
        <div className="tarjeta p-4 space-y-2" data-estado-dominio={estado.estado}>
          <p><span className={`pildora ${SEMAFORO[estado.estado][0]}`}>{SEMAFORO[estado.estado][1]}</span> <strong className="break-all">{estado.dominio}</strong></p>
          <p className="texto-suave">{estado.mensaje}</p>
          {estado.registros.length > 0 && (
            <table className="w-full text-sm" data-registros-dns>
              <thead><tr className="text-left texto-tenue"><th>Tipo</th><th>Nombre</th><th>Valor</th></tr></thead>
              <tbody>{estado.registros.map((r, i) => <tr key={i}><td className="pr-3 font-semibold">{r.tipo}</td><td className="pr-3">{r.nombre}</td><td className="break-all select-all">{r.valor}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
