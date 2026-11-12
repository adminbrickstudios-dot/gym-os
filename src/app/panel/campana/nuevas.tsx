import "server-only";
// N3 / N2 / N6 en Novedades: el resumen de la noche (solo el dueño), los aptos que vencen pronto (equipo) y "Qué hay de nuevo" (dueño y
// encargado). Cada bloque existe solo si el gimnasio prendió su función; apagada, esta pantalla queda exactamente como antes.
// Todo se calcula al abrir, con lo que pasó: no hay cron ni nada guardado.
import Link from "next/link";
import { Icono } from "@/components/ui/Icono";
import { formatearPesos } from "@/lib/formato";
import { rpc, type PanelGimnasio } from "@/lib/panel/servidor";

type Resumen = {
  dia: string; es_hoy: boolean; cobrado: number | string; cobros: number; por_medio: { medio: string; monto: number | string }[];
  entradas: number; personas: number; altas: number; bajas: number; cajas_abiertas: number; cajas_cerradas: number;
};
type Aptos = { dias: number; por_vencer: { socio_id: string; nombre: string; vence: string }[]; vencidos: { socio_id: string; nombre: string; vence: string }[]; sin_apto: number };
type Novedad = { clave: string; titulo: string; texto: string; desde: string };

const MEDIO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", mercadopago: "MercadoPago", debito: "Débito", credito: "Crédito", debito_automatico: "Débito automático", cuenta_corriente: "A cuenta" };
const dia = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export type DatosNuevas = { resumen: Resumen | null; aptos: Aptos | null; novedades: Novedad[] };

export async function cargarNuevas(panel: PanelGimnasio): Promise<DatosNuevas> {
  const g = panel.gimnasio.id, rol = panel.yo.rol;
  const activas = await rpc<string[]>("funciones_nuevas_activas", { p_gimnasio_id: g }, { lectura: true });
  const resumen = activas.includes("resumen_noche") && rol === "dueno" ? await rpc<Resumen>("resumen_noche", { p_gimnasio_id: g }, { lectura: true }) : null;
  let aptos: Aptos | null = null;
  if (activas.includes("apto_vencimiento") && (rol === "dueno" || rol === "encargado" || rol === "recepcion")) {
    try { aptos = await rpc<Aptos>("aptos_por_vencer", { p_gimnasio_id: g }, { lectura: true }); }
    catch (e) { if (!/no pide apto/i.test((e as Error).message)) throw e; }   // sin "Pedir apto físico" no hay nada que avisar
  }
  const novedades = (rol === "dueno" || rol === "encargado") && activas.length > 0 ? await rpc<Novedad[]>("que_hay_de_nuevo", { p_gimnasio_id: g }, { lectura: true }) : [];
  return { resumen, aptos, novedades };
}

export function Nuevas({ datos }: { datos: DatosNuevas }) {
  const { resumen: r, aptos: a, novedades } = datos;
  if (!r && !a && novedades.length === 0) return null;
  return (
    <div className="space-y-6 mb-10" data-funciones-nuevas-novedades>
      {r && (
        <section className="tarjeta p-5 sm:p-6 space-y-3" data-resumen-noche aria-labelledby="resumen-noche">
          <h2 id="resumen-noche" className="titulo text-2xl"><Icono nombre="luna" /> {r.es_hoy ? "Resumen del día" : `Resumen del ${dia(r.dia)}`}</h2>
          <p className="texto-suave">Se calcula al abrir esta pantalla, con lo que pasó hoy hasta ahora.</p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div data-resumen="cobrado"><dt className="texto-tenue text-sm">Cobrado</dt><dd className="numero text-2xl">{formatearPesos(r.cobrado)}</dd><dd className="text-sm texto-suave">{plural(r.cobros, "cobro", "cobros")}</dd></div>
            <div data-resumen="entradas"><dt className="texto-tenue text-sm">Entradas</dt><dd className="numero text-2xl">{r.entradas}</dd><dd className="text-sm texto-suave">{plural(r.personas, "persona", "personas")}</dd></div>
            <div data-resumen="altas"><dt className="texto-tenue text-sm">Altas</dt><dd className="numero text-2xl">{r.altas}</dd></div>
            <div data-resumen="bajas"><dt className="texto-tenue text-sm">Bajas</dt><dd className="numero text-2xl">{r.bajas}</dd></div>
            <div data-resumen="caja" className="col-span-2 sm:col-span-2"><dt className="texto-tenue text-sm">Caja</dt>
              <dd className="font-semibold">{r.cajas_abiertas > 0 ? `${plural(r.cajas_abiertas, "caja abierta", "cajas abiertas")}: falta cerrar` : r.cajas_cerradas > 0 ? `Cerrada (${plural(r.cajas_cerradas, "turno", "turnos")})` : "Sin movimiento de caja"}</dd></div>
          </dl>
          {r.por_medio.length > 0 && <p className="text-sm texto-suave" data-resumen="medios">{r.por_medio.map((m) => `${MEDIO[m.medio] ?? m.medio}: ${formatearPesos(m.monto)}`).join(" · ")}</p>}
        </section>
      )}

      {a && (
        <section className="tarjeta p-5 sm:p-6 space-y-3" data-aptos-por-vencer aria-labelledby="aptos-vencen">
          <h2 id="aptos-vencen" className="titulo text-2xl"><Icono nombre="documento" /> Aptos físicos</h2>
          {a.por_vencer.length === 0 && a.vencidos.length === 0
            ? <p className="texto-suave" data-aptos-nada>Ningún apto vence en los próximos {a.dias} días.</p>
            : (
              <>
                {a.por_vencer.length > 0 && (
                  <div data-aptos="por-vencer"><p className="font-semibold">Vencen en los próximos {a.dias} días ({a.por_vencer.length})</p>
                    <ul className="texto-suave">{a.por_vencer.map((x) => <li key={x.socio_id}><Link href={`/panel/socios/${x.socio_id}`} className="underline">{x.nombre}</Link> · vence el {dia(x.vence)}</li>)}</ul></div>
                )}
                {a.vencidos.length > 0 && (
                  <div data-aptos="vencidos"><p className="font-semibold">Ya vencieron ({a.vencidos.length})</p>
                    <ul className="texto-suave">{a.vencidos.map((x) => <li key={x.socio_id}><Link href={`/panel/socios/${x.socio_id}`} className="underline">{x.nombre}</Link> · venció el {dia(x.vence)}</li>)}</ul></div>
                )}
              </>
            )}
          {a.sin_apto > 0 && <p className="text-sm texto-suave" data-aptos="sin-apto">{plural(a.sin_apto, "socio con cuota al día todavía no tiene el apto cargado", "socios con cuota al día todavía no tienen el apto cargado")}.</p>}
        </section>
      )}

      {novedades.length > 0 && (
        <section className="tarjeta p-5 sm:p-6 space-y-3" data-que-hay-de-nuevo-panel aria-labelledby="que-hay-de-nuevo">
          <h2 id="que-hay-de-nuevo" className="titulo text-2xl"><Icono nombre="estrella" /> Qué hay de nuevo</h2>
          <ul className="space-y-2">
            {novedades.map((n) => <li key={n.clave} data-novedad-funcion={n.clave}><span className="font-semibold">{n.titulo}</span> <span className="texto-tenue text-sm">· desde el {dia(n.desde)}</span><span className="block texto-suave">{n.texto}</span></li>)}
          </ul>
          <Link href="/panel/configuracion?pestana=funciones" className="boton inline-flex">Ver las funciones nuevas</Link>
        </section>
      )}
    </div>
  );
}
