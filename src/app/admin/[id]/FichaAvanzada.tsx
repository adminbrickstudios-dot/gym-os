"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { formatearPesos } from "@/lib/formato";
import { whatsappDueno } from "@/lib/admin/lista";
import { borrarDefinitivo, clonarConfiguracion, guardarDescuento, guardarPrueba, quitarDescuento, reprocesarWebhook, restaurarPlan, restaurarSocio } from "../acciones";

const Alerta = ({ m }: { m: string }) => (m ? <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3">{m}</p> : null);
const diaLargo = (d: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export type AbonoDetalle = {
  estado: string; plan?: string; precio_mensual?: number; pagado_hasta?: string; dias?: number; en_prueba?: boolean;
  descuento?: { porcentaje: number; motivo: string; hasta: string } | null; precio_con_descuento?: number;
};

/** SA-7: prueba gratis, descuento con motivo y fecha de fin, y el recordatorio del abono por WhatsApp (monto y link de pago). */
export function AbonoExtra({ gimnasioId, nombre, abono, telefono, dueno, linkPago }: {
  gimnasioId: string; nombre: string; abono: AbonoDetalle; telefono: string | null; dueno: string | null; linkPago: string | null;
}) {
  const router = useRouter();
  const [dias, setDias] = useState("14");
  const [pct, setPct] = useState("");
  const [motivo, setMotivo] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState("");
  const hecho = async (f: () => Promise<{ error?: string }>) => { const r = await f(); if (r.error) { setError(r.error); return; } setError(""); router.refresh(); };
  const monto = abono.precio_con_descuento ?? abono.precio_mensual;
  const wa = abono.plan && monto != null && abono.pagado_hasta
    ? whatsappDueno(telefono, `Hola ${dueno ?? ""}, te escribo de BRIK: el abono de ${nombre} (plan ${abono.plan}, ${formatearPesos(monto)}) ${abono.estado === "vencido" ? "venció" : "vence"} el ${diaLargo(abono.pagado_hasta)}.${linkPago ? ` Podés pagarlo acá: ${linkPago}` : ""}`)
    : null;
  return (
    <section className="space-y-4" data-abono-extra>
      <p className="titulo-grupo">Prueba, descuento y recordatorio</p>
      {abono.plan && abono.en_prueba && <p className="texto-suave">Está en prueba gratis hasta el {abono.pagado_hasta ? diaLargo(abono.pagado_hasta) : "—"}. Al terminar sin un pago registrado, el panel queda en solo lectura (la puerta y la app siguen).</p>}
      <div className="flex flex-wrap gap-2 items-end">
        <label className="space-y-1"><span className="etiqueta">Días de prueba gratis (0 a 90)</span><input className="campo w-32" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} /></label>
        <BotonAccion className="boton" onClick={() => hecho(() => guardarPrueba(gimnasioId, Number(dias)))}>Guardar la prueba</BotonAccion>
      </div>
      {abono.descuento ? (
        <div className="tarjeta p-3 flex flex-wrap items-center gap-3" data-descuento>
          <span className="flex-1">Descuento del {abono.descuento.porcentaje}% hasta el {diaLargo(abono.descuento.hasta)}: {abono.descuento.motivo}. Paga {abono.precio_con_descuento != null ? formatearPesos(abono.precio_con_descuento) : ""}.</span>
          <BotonAccion className="boton texto-suave" onClick={() => hecho(() => quitarDescuento(gimnasioId))}>Quitar</BotonAccion>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-4 items-end">
          <label className="space-y-1"><span className="etiqueta">Descuento (%)</span><input className="campo" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
          <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Motivo</span><input className="campo" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} /></label>
          <label className="space-y-1"><span className="etiqueta">Hasta</span><input className="campo" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <div className="sm:col-span-4"><BotonAccion className="boton" disabled={!pct || motivo.trim().length < 5 || !hasta} onClick={() => hecho(() => guardarDescuento(gimnasioId, Number(pct.replace(",", ".")), motivo, hasta))}>Aplicar el descuento</BotonAccion></div>
        </div>
      )}
      {wa ? <a className="boton" href={wa} target="_blank" rel="noopener noreferrer" data-recordatorio-abono>Recordarle el abono por WhatsApp</a>
          : <p className="texto-tenue text-sm">Para el recordatorio por WhatsApp hace falta un plan asignado y el celular del dueño.</p>}
      <Alerta m={error} />
    </section>
  );
}

export type EnPapelera = { socios: { id: string; nombre: string; numero: number; baja: string }[]; planes: { id: string; nombre: string; tipo: string }[] };

/** SA-6: lo que el gimnasio quitó en los últimos 30 días, para restaurar. */
export function Papelera({ gimnasioId, papelera }: { gimnasioId: string; papelera: EnPapelera }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const hecho = async (f: () => Promise<{ error?: string }>) => { const r = await f(); if (r.error) { setError(r.error); return; } setError(""); router.refresh(); };
  if (papelera.socios.length === 0 && papelera.planes.length === 0) return <p className="texto-tenue">La papelera está vacía.</p>;
  return (
    <div className="space-y-2" data-papelera>
      {papelera.socios.map((s) => (
        <div key={s.id} className="tarjeta p-3 flex flex-wrap items-center gap-3"><span className="flex-1">Socio {s.nombre} (n.º {s.numero}), dado de baja el {new Date(s.baja).toLocaleDateString("es-AR")}</span>
          <BotonAccion className="boton" onClick={() => hecho(() => restaurarSocio(gimnasioId, s.id))}>Restaurar</BotonAccion></div>
      ))}
      {papelera.planes.map((p) => (
        <div key={p.id} className="tarjeta p-3 flex flex-wrap items-center gap-3"><span className="flex-1">Plan {p.nombre} (archivado)</span>
          <BotonAccion className="boton" onClick={() => hecho(() => restaurarPlan(gimnasioId, p.id))}>Restaurar</BotonAccion></div>
      ))}
      <Alerta m={error} />
    </div>
  );
}

/** SA-6: copiar planes, precios y lo prendido de otro gimnasio (sin socios). Solo a un gimnasio sin planes. */
export function Clonar({ destino, otros }: { destino: string; otros: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [origen, setOrigen] = useState("");
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  return (
    <div className="space-y-2" data-clonar>
      <p className="texto-suave">Copia los planes con su precio de hoy, las actividades y lo que tiene prendido. No copia socios ni plata. Solo sirve en un gimnasio que todavía no tiene planes.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <select className="campo flex-1 min-w-[12rem]" value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="Copiar de">
          <option value="">Copiar de…</option>{otros.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <BotonAccion className="boton" disabled={!origen} onClick={async () => {
          const r = await clonarConfiguracion(origen, destino);
          setMsj(r.error ? { texto: r.error } : { ok: true, texto: r.aviso }); if (!r.error) router.refresh();
        }}>Copiar la configuración</BotonAccion>
      </div>
      {msj.texto && <p role={msj.ok ? "status" : "alert"} className={msj.ok ? "texto-suave" : "pildora pildora-rojo !rounded-2xl !px-4 !py-3"}>{msj.texto}</p>}
    </div>
  );
}

/** SA-6: borrado definitivo = anonimizar. Escribir el nombre; solo el principal (la base lo valida). */
export function BorrarDefinitivo({ gimnasioId, nombre }: { gimnasioId: string; nombre: string }) {
  const router = useRouter();
  const [escrito, setEscrito] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="tarjeta p-4 space-y-2" data-borrar-definitivo>
      <p className="font-semibold">Borrado definitivo</p>
      <p className="texto-suave text-sm">Pasados 30 días de la baja. Se borran los datos personales de los socios y del equipo, y el gimnasio queda como &ldquo;Gimnasio borrado&rdquo;. Los pagos y las entradas se conservan sin nombre, para que la plata cuadre. No se puede deshacer.</p>
      <label className="space-y-1 block"><span className="etiqueta">Escribí el nombre del gimnasio: {nombre}</span><input className="campo" value={escrito} onChange={(e) => setEscrito(e.target.value)} /></label>
      <BotonAccion className="boton texto-suave" disabled={escrito.trim() !== nombre} onClick={async () => {
        const r = await borrarDefinitivo(gimnasioId, escrito);
        if (r.error) { setError(r.error); return; } router.refresh();
      }}>Borrar definitivamente</BotonAccion>
      <Alerta m={error} />
    </div>
  );
}

/** Reprocesar un aviso de MercadoPago fallido (a pedido, idempotente por pago y estado). */
export function Reprocesar({ eventoId, gimnasioId }: { eventoId: string; gimnasioId: string }) {
  const router = useRouter();
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  return (
    <span className="inline-flex flex-wrap gap-2 items-center">
      <BotonAccion className="boton" ocupadoTexto="Reprocesando…" onClick={async () => {
        const r = await reprocesarWebhook(eventoId, gimnasioId);
        setMsj(r.error ? { texto: r.error } : { ok: true, texto: r.aviso }); if (!r.error) router.refresh();
      }}>Reprocesar</BotonAccion>
      {msj.texto && <span role={msj.ok ? "status" : "alert"} className="texto-suave text-sm">{msj.texto}</span>}
    </span>
  );
}
