"use client";
import { Icono } from "@/components/ui/Icono";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { atenderDemo } from "./acciones";

export type PedidoDemo = { id: string; nombre: string; gimnasio: string | null; contacto: string; mensaje: string | null; creado_en: string; atendido_en: string | null };
const cuando = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/** VD-26: quienes pidieron una demo desde la página de Gym OS. Una lista simple; se marca cuando ya se los contactó. */
export function PedidosDemo({ pedidos }: { pedidos: PedidoDemo[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [, empezar] = useTransition();
  if (pedidos.length === 0) return null;
  return (
    <section className="space-y-3" data-pedidos-demo>
      <p className="titulo-grupo"><Icono nombre="persona" /> Pedidos de demo <span className="pildora pildora-azul align-middle" data-pedidos-demo-cantidad>{pedidos.length}</span></p>
      {error && <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3"><Icono nombre="alerta" /> {error}</p>}
      <div className="space-y-2">
        {pedidos.map((p) => (
          <div key={p.id} className="tarjeta p-4 space-y-2" data-pedido-demo>
            <p className="font-semibold break-words">{p.nombre}{p.gimnasio ? ` · ${p.gimnasio}` : ""} <span className="texto-tenue font-normal">· {cuando(p.creado_en)}</span></p>
            <p className="texto-suave break-all"><Icono nombre="telefono" /> {p.contacto}</p>
            {p.mensaje && <p className="break-words">{p.mensaje}</p>}
            <BotonAccion className="boton" onClick={async () => {
              const r = await atenderDemo(p.id);
              if (r.error) { setError(r.error); return; }
              empezar(() => router.refresh());
            }}><Icono nombre="ok" /> Ya lo contacté</BotonAccion>
          </div>
        ))}
      </div>
    </section>
  );
}
