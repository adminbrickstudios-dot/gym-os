"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { invitadoAInteresado } from "./acciones";

export type InvitadoSinSeguir = { invitado_id: string; nombre: string; invito: string; socio_id: string; dia: string };

/** FA-24: los invitados de los últimos 30 días que todavía no son interesados. Con su WhatsApp quedan como interesados, con quién los trajo. */
export function InvitadosPorSeguir({ invitados }: { invitados: InvitadoSinSeguir[] }) {
  if (invitados.length === 0) return null;
  return (
    <section className="tarjeta p-4 mb-4 space-y-3" aria-labelledby="invitados-seguir" data-invitados-seguir={invitados.length}>
      <h2 id="invitados-seguir" className="titulo text-xl">Invitados para seguir ({invitados.length})</h2>
      <p className="texto-suave text-sm">Vinieron con un socio y todavía no los tenés como interesados. Escribí su WhatsApp para poder escribirles.</p>
      <ul className="divide-y divide-[var(--borde)]">{invitados.map((i) => <Fila key={i.invitado_id} i={i} />)}</ul>
    </section>
  );
}

function Fila({ i }: { i: InvitadoSinSeguir }) {
  const [tel, setTel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <li className="py-3 space-y-2" data-invitado={i.invitado_id}>
      <p><b>{i.nombre}</b> <span className="texto-suave">· invitado de {i.invito}</span></p>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setError(null); empezar(async () => { const r = await invitadoAInteresado(i.invitado_id, tel); if (r.error) setError(r.error); }); }}>
        <input className="campo flex-1 min-w-48" type="tel" inputMode="tel" placeholder="WhatsApp: 387 555 1234" aria-label={`WhatsApp de ${i.nombre}`} value={tel} onChange={(e) => setTel(e.target.value)} />
        <button type="submit" className="boton" disabled={ocupado || !tel.trim()}>{ocupado ? "Guardando…" : "Anotar como interesado"}</button>
      </form>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </li>
  );
}
