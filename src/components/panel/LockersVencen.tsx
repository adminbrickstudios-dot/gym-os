import { LinkPanel } from "./LinkPanel";
import { Icono } from "@/components/ui/Icono";

export type LockerVence = { alquiler_id: string; locker: string; socio_id: string; socio: string; hasta: string; ultimo_dia: string; dias: number; vencido: boolean };

const dia = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const cuanto = (n: number) => (n < 0 ? `venció hace ${-n} ${-n === 1 ? "día" : "días"}` : n === 0 ? "vence hoy" : n === 1 ? "vence mañana" : `vence en ${n} días`);

/** VD-55: los lockers que vencen esta semana (o ya vencieron y siguen ocupados), en el Inicio del dueño, del encargado y de la recepción. */
export function LockersVencen({ items }: { items: LockerVence[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="lockers-vencen" data-lockers-vencen={items.length}>
      <h2 id="lockers-vencen" className="titulo text-3xl mb-1"><Icono nombre="candado" /> Lockers que vencen ({items.length})</h2>
      <p className="texto-suave mb-4">Esta semana, o ya vencidos y todavía ocupados. <LinkPanel href="/panel/lockers" siNoEsta="texto" className="underline">Ver los lockers</LinkPanel></p>
      <ul className="space-y-2">
        {items.slice(0, 8).map((x) => (
          <li key={x.alquiler_id} className="tarjeta px-4 py-3 min-w-0" data-locker-vence={x.locker}>
            <p className="font-semibold text-lg leading-tight break-words">Locker {x.locker} · {x.socio}</p>
            <p className="texto-suave text-[15px]">{x.vencido ? "" : ""}{cuanto(x.dias)} ({dia(x.ultimo_dia)})</p>
          </li>
        ))}
      </ul>
      {items.length > 8 && <p className="texto-suave mt-2">y {items.length - 8} más.</p>}
    </section>
  );
}
