"use client";
import { useEffect, useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { formatearPesos } from "@/lib/formato";
import { anonimizarSocio, asignarPlan, darDeBaja, resolverPedidoBaja, vistaCambioPlan, volverADarDeAlta, type VistaCambio } from "../acciones";
import { devolucionBaja, type CalculoDevolucion } from "../moderacion-acciones";
import { Icono } from "@/components/ui/Icono";

type Plan = { plan_id: string; nombre: string; precio: number | null };
const MOTIVOS: [string, string][] = [
  ["precio", "Precio"], ["horario", "Horario"], ["mudanza", "Se mudó"], ["otro_gimnasio", "Otro gimnasio"],
  ["sin_tiempo", "Sin tiempo"], ["insatisfecho", "No le gustó"], ["otro", "Otro"],
];

export function CambiarPlan({ socioId, actual, planes }: { socioId: string; actual: string | null; planes: Plan[] }) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<{ plan: Plan; vista: VistaCambio } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const cerrar = () => { setAbierto(false); setElegido(null); setError(null); };
  const confirmar = (planId: string) => empezar(async () => { const r = await asignarPlan(socioId, planId, !!actual); if (r.error) setError(r.error); else cerrar(); });
  if (!abierto) return <button type="button" className="boton" onClick={() => setAbierto(true)}>{actual ? "Cambiar plan" : "Asignar plan"}</button>;
  // Cambio (PLA-6, D6): antes de confirmar dice qué pasa con lo pagado. Sin plata automática.
  if (elegido) {
    const v = elegido.vista;
    const dif = v.precio_nuevo != null && v.precio_viejo != null ? v.precio_nuevo - v.precio_viejo : null;
    return (
      <div className="tarjeta p-4 w-full space-y-3" data-cambio-plan>
        <p className="font-semibold">De {v.plan_viejo} a {v.plan_nuevo}, desde hoy</p>
        <p>{v.dias_a_favor > 0
          ? <>Le quedan <strong>{v.dias_a_favor} {v.dias_a_favor === 1 ? "día pago" : "días pagos"}</strong> (hasta el {v.hasta!.split("-").reverse().slice(0, 2).join("/")}): pasan al {v.plan_nuevo}, sin cobrar nada.</>
          : <>No tiene días pagos por delante: el {v.plan_nuevo} arranca sin cubrir y se cobra la cuota en Vender.</>}</p>
        {dif != null && dif !== 0 && (
          <p className="texto-suave text-sm">{v.plan_nuevo} cuesta {formatearPesos(v.precio_nuevo)} por mes ({dif > 0 ? `${formatearPesos(dif)} más` : `${formatearPesos(-dif)} menos`}).
            {dif > 0 && v.dias_a_favor > 0 ? " Si querés cobrar la diferencia de estos días, hacelo en Vender con “Otra cosa”." : ""}</p>
        )}
        {v.congelado && <p className="pildora pildora-amarillo"><Icono nombre="pausa" /> Tiene una pausa en curso o programada: hay que resolverla antes.</p>}
        {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton boton-principal" disabled={ocupado || v.congelado} onClick={() => confirmar(elegido.plan.plan_id)}><Icono nombre="ok" /> Cambiar a {v.plan_nuevo}</button>
          {dif != null && dif > 0 && v.dias_a_favor > 0 && <LinkPanel href={`/panel/vender?socio=${socioId}`} className="boton"><Icono nombre="plata" /> Ir a Vender</LinkPanel>}
          <button type="button" className="boton" onClick={() => { setElegido(null); setError(null); }}>← Otro plan</button>
        </div>
      </div>
    );
  }
  return (
    <div className="tarjeta p-4 w-full space-y-3">
      <p className="font-semibold">{actual ? "Elegí el plan nuevo" : "Elegí el plan"}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {planes.filter((p) => p.plan_id !== actual).map((p) => (
          <button key={p.plan_id} type="button" disabled={ocupado} className="boton !justify-between"
            onClick={() => actual
              ? empezar(async () => { const r = await vistaCambioPlan(socioId, p.plan_id); if (r.error) setError(r.error); else { setError(null); setElegido({ plan: p, vista: r.vista! }); } })
              : confirmar(p.plan_id)}>
            <span>{p.nombre}</span>{p.precio != null && <span className="texto-suave">{formatearPesos(p.precio)}</span>}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
    </div>
  );
}

export function DarDeBaja({ socioId, ofrecePausa = false }: { socioId: string; ofrecePausa?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  // RET-3: antes de confirmar, si tiene sentido, ofrecer una pausa.
  const [motivo, setMotivo] = useState<[string, string] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  // VD-46J: si pagó por adelantado, se avisa antes de confirmar cuánto corresponde devolver (la baja sola no devuelve nada).
  const [dev, setDev] = useState<CalculoDevolucion | null>(null);
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    devolucionBaja(socioId).then((r) => { if (vivo && r.calculo) setDev(r.calculo); });
    return () => { vivo = false; };
  }, [abierto, socioId]);
  const baja = (v: string) => empezar(async () => { const r = await darDeBaja(socioId, v); if (r.error) setError(r.error); else { setAbierto(false); setMotivo(null); } });
  if (!abierto) return <button type="button" className="boton texto-suave" onClick={() => setAbierto(true)}><Icono nombre="salir" /> Dar de baja</button>;
  if (motivo) {
    return (
      <div className="tarjeta p-4 w-full space-y-3" data-ofrecer-pausa>
        <p className="font-semibold">Antes de darlo de baja: ¿le ofreciste una pausa?</p>
        <p className="texto-suave">Si se toma un tiempo, no pierde su plan ni sus días, y es más fácil que vuelva.</p>
        <div className="flex flex-wrap gap-2">
          <a href="#pausa" className="boton" onClick={() => { setAbierto(false); setMotivo(null); }}><Icono nombre="pausa" /> Ofrecerle una pausa</a>
          <button type="button" disabled={ocupado} className="boton boton-peligro" onClick={() => baja(motivo[0])}>Dar de baja igual ({motivo[1]})</button>
          <button type="button" className="boton-texto texto-suave" onClick={() => setMotivo(null)}>Volver</button>
        </div>
        {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      </div>
    );
  }
  return (
    <div className="tarjeta p-4 w-full space-y-3">
      <p className="font-semibold">¿Por qué se va? Sirve para saber qué mejorar.</p>
      <p className="texto-suave text-sm" data-baja-cierra>Al darlo de baja se anulan sus pagos por aprobar, sus turnos fijos y sus reservas de clases que vienen. Lo que ya pagó no se toca.</p>
      {dev?.hay && (
        <p className="mensaje mensaje-aviso" data-baja-devolucion><Icono nombre="deshacer" /> <span>{dev.total != null
          ? <>Pagó por adelantado: si se va hoy corresponden <strong>{formatearPesos(dev.total)}</strong> de devolución. La baja sola no devuelve nada: se registra después, en su ficha.</>
          : <>Tiene períodos pagados por adelantado: la devolución la decide el dueño o el encargado.</>}</span></p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MOTIVOS.map(([v, t]) => (
          <button key={v} type="button" disabled={ocupado} className="boton"
            onClick={() => (ofrecePausa && !["mudanza", "otro_gimnasio"].includes(v) ? setMotivo([v, t]) : baja(v))}>{t}</button>
        ))}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
    </div>
  );
}

export function VolverADarDeAlta({ socioId }: { socioId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" disabled={ocupado} className="boton boton-principal"
        onClick={() => empezar(async () => { const r = await volverADarDeAlta(socioId); setError(r.error ?? null); })}>
        {ocupado ? "Guardando…" : "Volver a darlo de alta"}
      </button>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}

/** APP-8: el socio pidió la baja desde la app. Se habla con él: se queda, o se le da la baja con el motivo que dio. */
export function PedidoBaja({ socioId, pedido }: { socioId: string; pedido: { pedido_id: string; motivo: string; nota: string | null; codigo?: string; pedido_en?: string } }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const motivo = MOTIVOS.find(([v]) => v === pedido.motivo)?.[1] ?? pedido.motivo;
  const resolver = (baja: boolean) => empezar(async () => { const r = await resolverPedidoBaja(socioId, pedido.pedido_id, baja); setError(r.error ?? null); });
  return (
    <div className="mensaje mensaje-aviso mt-4 space-y-3" data-pedido-baja>
      <p><span className="font-semibold"><Icono nombre="salir" /> Pidió la baja desde la app</span> · {motivo}{pedido.nota ? `: “${pedido.nota}”` : ""}</p>
      {pedido.codigo && <p className="text-sm" data-codigo-baja><Icono nombre="recibo" /> Constancia <strong>{pedido.codigo}</strong>: es el código que ya tiene el socio en su app.</p>}
      <p className="texto-suave text-sm">Hablale antes: a veces una pausa o un cambio de plan alcanza. Dar la baja anula sus pagos por aprobar, sus turnos fijos y sus reservas de clases que vienen; lo que ya pagó no se toca.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} className="boton" onClick={() => resolver(false)}><Icono nombre="pesa" /> Se queda</button>
        <button type="button" disabled={ocupado} className="boton boton-peligro" onClick={() => resolver(true)}>Darle la baja</button>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}

/** SEG-6: a un ex socio que lo pide, el dueño le borra los datos personales (no se deshace; quedan los pagos). */
export function BorrarDatos({ socioId }: { socioId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!abierto) return <button type="button" className="boton-texto texto-suave" onClick={() => setAbierto(true)}><Icono nombre="papelera" /> Borrar sus datos personales</button>;
  return (
    <div className="tarjeta p-4 space-y-3 w-full" data-borrar-datos>
      <p className="font-semibold">Se borran nombre, DNI, teléfono, mail, nacimiento, foto y notas. Quedan los pagos y las entradas, a nombre de “Socio borrado”. No se deshace.</p>
      <input className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí BORRAR" aria-label="Escribí BORRAR para confirmar" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton boton-peligro" disabled={ocupado || texto !== "BORRAR"}
          onClick={() => empezar(async () => { const r = await anonimizarSocio(socioId, texto); setError(r.error ?? null); if (!r.error) setAbierto(false); })}>Borrar sus datos</button>
        <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
