// Pase 2.0 · organización (26/11 · organizacion/inicio.png): "Plata en juego hoy" en el Inicio. Solo muestra lo que calcula la base
// (plata_en_juego: vencen hoy + deben + transferencias por aprobar, e interesados de ayer sin plata): no mueve plata ni calcula nada acá.
// "Resolver ahora" lleva a Para hacer hoy. Lo vacío no se muestra (regla 5).
import Link from "next/link";
import { formatearPesos } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";

export type PlataEnJuegoDatos = {
  total: number | string;
  vencen_hoy: { cantidad: number; monto: number | string };
  deben: { cantidad: number; monto: number | string };
  transferencias: { cantidad: number; monto: number | string };
  interesados: { cantidad: number };
};

export function PlataEnJuego({ datos, resolver = "/panel/bloque/hoy" }: { datos: PlataEnJuegoDatos | null; resolver?: string }) {
  if (!datos) return null;
  const partes = [
    datos.vencen_hoy.cantidad > 0 && { clave: "vencen", icono: "reloj-arena", titulo: `${datos.vencen_hoy.cantidad} vencen hoy`, linea: `${formatearPesos(datos.vencen_hoy.monto)} si renuevan` },
    datos.deben.cantidad > 0 && { clave: "deben", icono: "plata", titulo: `${datos.deben.cantidad} deben`, linea: `${formatearPesos(datos.deben.monto)} para cobrar` },
    datos.transferencias.cantidad > 0 && { clave: "transferencias", icono: "banco", titulo: `${datos.transferencias.cantidad} ${datos.transferencias.cantidad === 1 ? "transferencia" : "transferencias"}`, linea: `${formatearPesos(datos.transferencias.monto)} por aprobar` },
    datos.interesados.cantidad > 0 && { clave: "interesados", icono: "hoja", titulo: `${datos.interesados.cantidad} ${datos.interesados.cantidad === 1 ? "interesado" : "interesados"}`, linea: "Probaron ayer, sin plan" },
  ].filter((x): x is { clave: string; icono: string; titulo: string; linea: string } => !!x);
  if (!partes.length) return null;
  return (
    <section aria-labelledby="plata-en-juego" className="tarjeta p-5 sm:p-6 flex flex-wrap items-center gap-4 border-2" style={{ borderColor: "var(--atencion)" }} data-plata-en-juego={String(datos.total)}>
      <div className="min-w-48">
        <h2 id="plata-en-juego" className="etiqueta" style={{ color: "var(--atencion)" }}><Icono nombre="plata" /> Plata en juego hoy</h2>
        <p className="numero text-5xl sm:text-6xl leading-none mt-1" style={{ color: "var(--atencion)" }}>{formatearPesos(datos.total)}</p>
      </div>
      <ul className="flex flex-1 flex-wrap gap-2">
        {partes.map((p) => (
          <li key={p.clave} className="rounded-[var(--radio)] bg-[var(--tarjeta-alta)] px-4 py-3 min-w-40 flex-1" data-plata-parte={p.clave}>
            <span className="block font-semibold"><Icono nombre={p.icono} /> {p.titulo}</span>
            <span className="block texto-suave text-sm">{p.linea}</span>
          </li>
        ))}
      </ul>
      <Link href={resolver} className="boton boton-principal" data-resolver-ahora>Resolver ahora</Link>
    </section>
  );
}

/** "Volvieron este mes": los que estuvieron 14 días o más sin venir (o vencidos) y este mes volvieron a pagar (volvieron_mes). */
export function VolvieronMes({ cantidad }: { cantidad: number | null }) {
  if (cantidad == null) return null;
  return (
    <div className="tarjeta p-5 border-2" style={{ borderColor: "color-mix(in oklab, var(--prueba), transparent 50%)" }} data-volvieron-mes={cantidad}>
      <p className="numero text-5xl leading-none" style={{ color: "var(--prueba)" }}>{cantidad}</p>
      <p className="font-semibold mt-2"><Icono nombre="repetir" /> Volvieron este mes</p>
      <p className="texto-suave text-sm">Estaban sin venir y volvieron a pagar</p>
    </div>
  );
}
