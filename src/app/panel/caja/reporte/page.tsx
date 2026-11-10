import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { Vacio } from "@/components/ui/Vacio";
import { MEDIO, linkCompartir, textoCierre, textoDia, veredictoCaja } from "@/lib/caja";
import { formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { ReporteDia, ReporteTurno } from "../tipos";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Reporte de caja" };

const COLOR = { justa: "pildora-verde", sobra: "pildora-amarillo", falta: "pildora-rojo", sin_contar: "pildora-amarillo" } as const;
const ESTADO: Record<string, string> = { abierto: "Abierto", sin_contar: "Sin contar", sin_contar_dejada: "Se dejó sin contar", contada_despues: "Contada después", cerrado: "Cerrado" };
const dia_ok = (s?: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? "") ? s : undefined);
const mover = (d: string, n: number) => { const f = new Date(`${d}T12:00:00Z`); f.setUTCDate(f.getUTCDate() + n); return f.toISOString().slice(0, 10); };

/**
 * VD-9 · Reporte de caja. ?turno= : el reporte del turno (X mientras está abierto, el cierre cuando ya cerró).
 * Sin turno: el del día (Z) de la sede, con SOBRA / FALTA en grande y lo que quedó sin contar aparte.
 */
export default async function Reporte({ searchParams }: { searchParams: Promise<{ turno?: string; dia?: string; sede?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "caja");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const zona = panel.gimnasio.zona_horaria;
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));

    if (/^[0-9a-f-]{36}$/.test(sp.turno ?? "")) {
      const r = await rpc<ReporteTurno>("reporte_turno", { p_turno_id: sp.turno });
      const v = veredictoCaja(r.diferencia);
      const otros = r.por_medio.filter((m) => m.medio !== "efectivo");
      return (
        <>
          <Encabezado icono="lista" titulo={r.estado === "abierto" ? "Reporte del turno (en vivo)" : "Reporte del turno"} volver={{ href: "/panel/caja", texto: "Caja" }} volverAlOrigen
            bajada={`${r.caja} · ${cuando(r.abierto_en)}${r.cerrado_en ? ` a ${hora(r.cerrado_en)}` : ""} · abrió ${r.abierto_por ?? "—"}${r.cerrado_por ? ` · contó ${r.cerrado_por}` : ""}`} />
          <section className="tarjeta p-6 sm:p-8 space-y-6" data-reporte-turno={r.estado} data-veredicto={v.clave} aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              <span className="pildora">{ESTADO[r.estado] ?? r.estado}</span>
              {r.contado_en && r.estado === "contada_despues" && <span className="texto-suave text-sm">La contó {r.cerrado_por ?? "—"} el {cuando(r.contado_en)}</span>}
            </div>
            <p className={`titular text-4xl sm:text-5xl ${v.clave === "falta" ? "text-rojo" : ""}`} data-sobra-falta>{r.estado === "abierto" ? "Todavía abierto" : v.texto}</p>
            {r.estado === "sin_contar" && <p className="texto-suave">Esta caja se cerró sola y nadie la contó: lo de abajo es lo que tenía que haber según lo cobrado. La cuenta el dueño o el encargado en Caja → Para revisar.</p>}
            {r.estado === "sin_contar_dejada" && <p className="texto-suave">Se dejó sin contar: “{r.revisado_nota}”.</p>}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><dt className="texto-tenue text-sm">Inicial</dt><dd className="numero text-2xl">{formatearPesos(r.monto_inicial)}</dd></div>
              <div><dt className="texto-tenue text-sm"><Icono nombre="plata" /> Cobrado en efectivo</dt><dd className="numero text-2xl">{formatearPesos(r.efectivo)}</dd></div>
              <div><dt className="texto-tenue text-sm">Entró − salió</dt><dd className="numero text-2xl">{formatearPesos(r.ingresos - r.retiros)}</dd></div>
              <div><dt className="texto-tenue text-sm">Tenía que haber</dt><dd className="numero text-2xl" style={{ color: "var(--acento)" }}>{formatearPesos(r.esperado)}</dd></div>
              <div><dt className="texto-tenue text-sm">Contado</dt><dd className="numero text-2xl">{r.contado == null ? "—" : formatearPesos(r.contado)}</dd></div>
              <div><dt className="texto-tenue text-sm">Diferencia</dt><dd className="numero text-2xl">{r.diferencia == null ? "—" : formatearPesos(r.diferencia)}</dd></div>
            </dl>
            {r.billetes && (
              <p className="texto-suave text-sm" data-billetes-contados><Icono nombre="calculadora" /> Billetes: {Object.entries(r.billetes).filter(([k]) => k !== "otros").sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, n]) => `${n} × ${formatearPesos(Number(k))}`).join(" · ")}{r.billetes.otros ? ` · otros ${formatearPesos(r.billetes.otros)}` : ""}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="font-semibold mb-1">Ventas del turno</p>
                <p className="numero text-xl">{formatearPesos(r.ventas.total)} <span className="texto-suave text-base">en {r.ventas.cantidad} {r.ventas.cantidad === 1 ? "venta" : "ventas"}</span></p>
                {otros.length > 0 && <p className="texto-suave text-sm mt-1">Además del efectivo: {otros.map((m) => `${MEDIO[m.medio] ?? m.medio} ${formatearPesos(m.total)}`).join(" · ")}</p>}
                {r.anuladas.cantidad > 0 && <p className="texto-suave text-sm mt-1"><Icono nombre="deshacer" /> {r.anuladas.cantidad} anulada{r.anuladas.cantidad === 1 ? "" : "s"} ({formatearPesos(r.anuladas.total)})</p>}
                {r.dejados_pasar > 0 && <p className="texto-suave text-sm mt-1"><Icono nombre="puerta" /> Dejaron pasar sin pagar: {r.dejados_pasar}</p>}
              </div>
              <div>
                <p className="font-semibold mb-1">Entradas y salidas de plata</p>
                {r.movimientos.length === 0 ? <p className="texto-tenue">No hubo.</p> : (
                  <ul className="space-y-1 text-sm">
                    {r.movimientos.map((m, i) => <li key={i}>{m.tipo === "retiro" ? "" : ""} {formatearPesos(m.monto)} · {m.motivo} <span className="texto-tenue">({hora(m.en)}{m.por ? `, ${m.por}` : ""})</span></li>)}
                  </ul>
                )}
              </div>
            </div>
            {r.nota && <p className="text-sm"><Icono nombre="lista" /> {r.nota}</p>}
            {r.cerrado_en && (
              <a className="boton" target="_blank" rel="noopener noreferrer" data-compartir-cierre
                href={linkCompartir(textoCierre({ ...r, abrio: r.abierto_por, cerro: r.cerrado_por, cuando: `${cuando(r.abierto_en)} a ${hora(r.cerrado_en)}` }))}><Icono nombre="celular" /> Mandar por WhatsApp</a>
            )}
          </section>
        </>
      );
    }

    // El día (Z): solo el dueño y el encargado.
    exigirRol(panel, ["dueno", "encargado"]);
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const diaPedido = dia_ok(sp.dia);
    const z = await rpc<ReporteDia>("reporte_dia", { p_sede_id: sede.id, p_dia: diaPedido ?? null });
    const contados = z.turnos.filter((t) => t.contado != null).length;
    const v = veredictoCaja(contados > 0 ? z.diferencia : null);
    const sedeQ = sp.sede ? `&sede=${sp.sede}` : "";
    const ayer = mover(z.dia, -1), manana = mover(z.dia, 1);
    const fechaLarga = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${z.dia}T12:00:00Z`));
    return (
      <>
        <Encabezado icono="lista" titulo="Cierre del día" volver={{ href: "/panel/caja", texto: "Caja" }} volverAlOrigen bajada={`${sede.nombre} · ${fechaLarga}`} />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/caja/reporte" />}
        <nav className="flex flex-wrap gap-2" aria-label="Cambiar de día">
          <Link className="boton boton-chico" href={`/panel/caja/reporte?dia=${ayer}${sedeQ}`}>← Día anterior</Link>
          <Link className="boton boton-chico" href={`/panel/caja/reporte?dia=${manana}${sedeQ}`}>Día siguiente →</Link>
        </nav>
        {z.turnos.length === 0 ? <Vacio icono="lista" titulo="Ese día no se abrió ninguna caja">Cuando se abra un turno, el cierre del día aparece acá.</Vacio> : (
          <section className="tarjeta p-6 sm:p-8 space-y-6" data-reporte-dia={z.turnos.length} data-veredicto={v.clave}>
            <p className={`titular text-4xl sm:text-5xl ${v.clave === "falta" ? "text-rojo" : ""}`} data-sobra-falta>{v.clave === "sin_contar" ? "Todavía sin contar" : v.texto}</p>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><dt className="texto-tenue text-sm">Vendido</dt><dd className="numero text-2xl">{formatearPesos(z.ventas.total)}</dd></div>
              <div><dt className="texto-tenue text-sm">Tenía que haber (contadas)</dt><dd className="numero text-2xl">{formatearPesos(z.esperado_contado)}</dd></div>
              <div><dt className="texto-tenue text-sm">Contado</dt><dd className="numero text-2xl">{formatearPesos(z.contado)}</dd></div>
              <div><dt className="texto-tenue text-sm">Retiros</dt><dd className="numero text-2xl">{formatearPesos(z.retiros)}</dd></div>
            </dl>
            {z.sin_contar > 0 && <p className="pildora pildora-amarillo !rounded-2xl !px-4 !py-3 whitespace-normal" data-sin-contar-dia><Icono nombre="recibo" /> {z.sin_contar} {z.sin_contar === 1 ? "caja quedó" : "cajas quedaron"} sin contar (tenían que tener {formatearPesos(z.esperado_sin_contar)}). No entran en el sobra/falta: <Link href="/panel/caja" className="underline">Caja → Para revisar</Link>.</p>}
            {z.abiertos > 0 && <p className="texto-suave"><Icono nombre="candado-abierto" /> {z.abiertos} {z.abiertos === 1 ? "turno sigue abierto" : "turnos siguen abiertos"}: el día no está cerrado.</p>}
            {z.por_medio.length > 0 && <p className="texto-suave">Por medio: {z.por_medio.map((m) => `${MEDIO[m.medio] ?? m.medio} ${formatearPesos(m.total)}`).join(" · ")}</p>}
            <p className="texto-suave text-sm">{z.ventas.cantidad} {z.ventas.cantidad === 1 ? "venta" : "ventas"}{z.anuladas ? ` · ${z.anuladas} anulada${z.anuladas === 1 ? "" : "s"}` : ""}{z.dejados_pasar ? ` · ${z.dejados_pasar} dejado${z.dejados_pasar === 1 ? "" : "s"} pasar sin pagar` : ""}</p>
            <ul className="space-y-2" data-turnos-dia>
              {z.turnos.map((t) => {
                const tv = veredictoCaja(t.diferencia);
                return (
                  <li key={t.turno_id}>
                    <Link href={`/panel/caja/reporte?turno=${t.turno_id}`} className="tarjeta px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[56px]">
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{t.caja} · {hora(t.abierto_en)}{t.cerrado_en ? ` a ${hora(t.cerrado_en)}` : ""}</span>
                        <span className="block text-sm texto-suave">{t.abierto_por ?? "—"} · {ESTADO[t.estado] ?? t.estado}</span></span>
                      <span className={`pildora ${COLOR[tv.clave]}`}>{t.estado === "abierto" ? "Abierto" : tv.texto}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <a className="boton" target="_blank" rel="noopener noreferrer" data-compartir-dia
              href={linkCompartir(textoDia({ ...z, sede: sede.nombre, dia: fechaLarga, contados }))}><Icono nombre="celular" /> Mandar el cierre del día por WhatsApp</a>
          </section>
        )}
      </>
    );
  });
}
