"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { darRolBrik, exigir2fa, quitarRolBrik } from "../acciones";

export type EstadoSeguridad = {
  exigir_2fa: boolean; yo_tengo_2fa: boolean; mi_rol: string;
  equipo: { usuario_id: string; email: string; rol: string; tiene_2fa: boolean; soy_yo: boolean }[];
};
const ROLES: [string, string, string][] = [
  ["principal", "Principal", "Todo."],
  ["soporte", "Soporte", "Entrar como soporte, ayudas y buscar."],
  ["ventas", "Ventas", "Demos, altas y abonos; no entra a los gimnasios."],
  ["lectura", "Solo lectura", "Ve todo, no cambia nada."],
];

export function EquipoBrik({ estado }: { estado: EstadoSeguridad }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("soporte");
  const [error, setError] = useState("");
  const principal = estado.mi_rol === "principal";
  const hecho = async (f: () => Promise<{ error?: string }>) => { const r = await f(); if (r.error) { setError(r.error); return; } setError(""); setEmail(""); router.refresh(); };
  return (
    <div className="space-y-6" data-equipo-brik>
      <section className="space-y-2">
        <p className="titulo-grupo">Segundo factor obligatorio</p>
        <p className="texto-suave">{estado.exigir_2fa ? "Está exigido: para entrar al super admin hay que confirmar el código." : "No está exigido todavía. Activá tu verificación, confirmá el código y recién ahí exigilo."}</p>
        {principal && (
          <BotonAccion className="boton" onClick={() => hecho(() => exigir2fa(!estado.exigir_2fa))}>{estado.exigir_2fa ? "Dejar de exigirlo" : "Exigirlo para todos"}</BotonAccion>
        )}
      </section>
      <section className="space-y-3">
        <p className="titulo-grupo">Usuarios de BRIK</p>
        <ul className="space-y-2">
          {estado.equipo.map((u) => (
            <li key={u.usuario_id} className="tarjeta p-3 flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 break-all"><span className="font-semibold">{u.email}</span>{u.soy_yo && " (vos)"} · {ROLES.find(([k]) => k === u.rol)?.[1] ?? u.rol} · {u.tiene_2fa ? "con dos pasos" : "sin dos pasos"}</span>
              {principal && !u.soy_yo && <BotonAccion className="boton texto-suave" onClick={() => hecho(() => quitarRolBrik(u.usuario_id))}>Sacar</BotonAccion>}
            </li>
          ))}
        </ul>
        {principal && (
          <div className="tarjeta p-4 grid gap-3 sm:grid-cols-3 items-end">
            <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Mail de la cuenta (ya tiene que existir)</span><input className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="space-y-1"><span className="etiqueta">Rol</span>
              <select className="campo" value={rol} onChange={(e) => setRol(e.target.value)}>{ROLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
            <p className="texto-suave text-sm sm:col-span-3">{ROLES.find(([k]) => k === rol)?.[2]}</p>
            <div className="sm:col-span-3"><BotonAccion className="boton boton-principal" disabled={!email.includes("@")} onClick={() => hecho(() => darRolBrik(email, rol))}>Dar o cambiar el rol</BotonAccion></div>
          </div>
        )}
        {error && <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3">{error}</p>}
      </section>
    </div>
  );
}
