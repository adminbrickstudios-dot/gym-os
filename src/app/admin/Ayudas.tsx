"use client";
import { Icono } from "@/components/ui/Icono";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { resolverAyuda } from "./acciones";

export type PedidoAyuda = {
  id: string; gimnasio_id: string; gimnasio: string; quien: string; rol: string; mail: string | null; mensaje: string;
  pantalla: string | null; ultimo_error: string | null; creado_en: string; resuelta_en: string | null;
};
const cuando = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/** VD-40: los pedidos de ayuda de los dueños, con el contexto con el que se mandaron. */
export function Ayudas({ pedidos }: { pedidos: PedidoAyuda[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [, empezar] = useTransition();
  if (pedidos.length === 0) return null;
  return (
    <section className="space-y-3" data-ayudas>
      <p className="titulo-grupo"><Icono nombre="ayuda" /> Pedidos de ayuda <span className="pildora pildora-amarillo align-middle" data-ayudas-cantidad>{pedidos.length}</span></p>
      {error && <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3"><Icono nombre="alerta" /> {error}</p>}
      <div className="space-y-2">
        {pedidos.map((p) => (
          <div key={p.id} className="tarjeta p-4 space-y-2" data-ayuda>
            <p className="font-semibold">{p.gimnasio} <span className="texto-tenue font-normal">· {p.quien} ({p.rol}) · {cuando(p.creado_en)}</span></p>
            <p className="break-words">{p.mensaje}</p>
            <p className="texto-suave text-sm break-all" data-ayuda-contexto>
              <Icono nombre="ubicacion" /> {p.pantalla ?? "pantalla desconocida"}{p.mail ? <> · <Icono nombre="mail" /> {p.mail}</> : null}
              {p.ultimo_error && <span className="block"><Icono nombre="alerta" /> Último error: {p.ultimo_error}</span>}
            </p>
            <BotonAccion className="boton" onClick={async () => {
              const r = await resolverAyuda(p.id);
              if (r.error) { setError(r.error); return; }
              empezar(() => router.refresh());
            }}><Icono nombre="ok" /> Ya lo resolví</BotonAccion>
          </div>
        ))}
      </div>
    </section>
  );
}
