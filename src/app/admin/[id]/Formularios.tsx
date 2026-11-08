"use client";
import { CampoContrasena } from "@/components/cuentas/CampoContrasena";
import { useActionState, useState, useTransition } from "react";
import { ContrasenaNueva } from "@/components/cuentas/AccesoPersona";
import { NOMBRE_ROL, type Rol } from "@/lib/panel/secciones";
import { agregarDominio, agregarPersona, quitarDominio, type Resultado } from "../acciones";
import { Mensaje } from "@/components/ui/Mensaje";

export function AgregarPersona({ gimnasioId }: { gimnasioId: string }) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(agregarPersona, {});
  return (
    <form action={accion} className="tarjeta p-5 grid sm:grid-cols-3 gap-3">
      <p className="titulo text-xl sm:col-span-3">➕ Sumar a alguien</p>
      <input type="hidden" name="gimnasio_id" value={gimnasioId} />
      <label className="space-y-1"><span className="etiqueta">Nombre</span><input name="nombre" required className="campo" /></label>
      <label className="space-y-1"><span className="etiqueta">Mail</span><input name="email" type="email" className="campo" placeholder="Para que entre al sistema" /></label>
      <label className="space-y-1"><span className="etiqueta">Contraseña</span><CampoContrasena /></label>
      <label className="space-y-1"><span className="etiqueta">Rol</span>
        <select name="rol" className="campo" defaultValue="dueno">{(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}</select></label>
      <div className="sm:col-span-3"><ContrasenaNueva r={estado} /></div>
      <div className="sm:col-span-3"><button className="boton" disabled={guardando}>{guardando ? "Sumando…" : "➕ Sumar"}</button></div>
    </form>
  );
}

type Dominio = { dominio_id: string; host: string; tipo: "subdominio" | "propio" };

export function Direcciones({ gimnasioId, dominios }: { gimnasioId: string; dominios: Dominio[] }) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(agregarDominio, {});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {dominios.map((d) => (
          <li key={d.dominio_id} className="tarjeta p-4 flex flex-wrap items-center gap-3">
            <span className="flex-1 min-w-0 break-all"><strong>{d.host}</strong> <span className="texto-tenue text-sm">· {d.tipo === "propio" ? "dirección propia" : "subdominio de Gym OS"}</span></span>
            {d.tipo === "propio" && (
              <button type="button" className="boton boton-chico texto-suave" disabled={ocupado}
                onClick={() => { if (confirm(`¿Quitar ${d.host}? El gimnasio deja de abrir en esa dirección.`)) empezar(async () => setError((await quitarDominio(gimnasioId, d.dominio_id)).error ?? null)); }}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <form action={accion} className="tarjeta p-5 space-y-3">
        <p className="titulo text-xl">➕ Sumar una dirección</p>
        <p className="texto-suave text-sm">
          Un dominio del gimnasio (www.olympogym.com) o, mientras no haya dominio, una dirección gratis de Vercel
          (olympo-gym.vercel.app). Después agregala igual en Vercel → tu proyecto → Settings → Domains.
        </p>
        <input type="hidden" name="gimnasio_id" value={gimnasioId} />
        <div className="flex flex-wrap gap-2">
          <input name="host" required className="campo flex-1 min-w-56" placeholder="olympo-gym.vercel.app" aria-label="Dirección" />
          <button className="boton" disabled={guardando}>{guardando ? "Sumando…" : "Sumar"}</button>
        </div>
        <ContrasenaNueva r={estado} />
      </form>
    </div>
  );
}
