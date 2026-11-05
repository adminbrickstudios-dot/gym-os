"use client";
import { useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { formatearPesos } from "@/lib/formato";
import { asignarPlan, darDeBaja, resolverPedidoBaja, vistaCambioPlan, volverADarDeAlta, type VistaCambio } from "../acciones";

type Plan = { plan_id: string; nombre: string; precio: number | null };
const MOTIVOS: [string, string][] = [
  ["precio", "💸 Precio"], ["horario", "⏰ Horario"], ["mudanza", "📦 Se mudó"], ["otro_gimnasio", "🏋️ Otro gimnasio"],
  ["sin_tiempo", "⌛ Sin tiempo"], ["insatisfecho", "😕 No le gustó"], ["otro", "Otro"],
];

export function CambiarPlan({ socioId, actual, planes }: { socioId: string; actual: string | null; planes: Plan[] }) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<{ plan: Plan; vista: VistaCambio } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const cerrar = () => { setAbierto(false); setElegido(null); setError(null); };
  const confirmar = (planId: string) => empezar(async () => { const r = await asignarPlan(socioId, planId, !!actual); if (r.error) setError(r.error); else cerrar(); });
  if (!abierto) return <button type="button" className="boton" onClick={() => setAbierto(true)}>{actual ? "🔄 Cambiar plan" : "🏷️ Asignar plan"}</button>;
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
        {v.congelado && <p className="pildora pildora-amarillo">⏸️ Tiene una pausa en curso o programada: hay que resolverla antes.</p>}
        {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton boton-principal" disabled={ocupado || v.congelado} onClick={() => confirmar(elegido.plan.plan_id)}>✅ Cambiar a {v.plan_nuevo}</button>
          {dif != null && dif > 0 && v.dias_a_favor > 0 && <LinkPanel href={`/panel/vender?socio=${socioId}`} className="boton">💵 Ir a Vender</LinkPanel>}
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
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
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
  const baja = (v: string) => empezar(async () => { const r = await darDeBaja(socioId, v); if (r.error) setError(r.error); else { setAbierto(false); setMotivo(null); } });
  if (!abierto) return <button type="button" className="boton texto-suave" onClick={() => setAbierto(true)}>👋 Dar de baja</button>;
  if (motivo) {
    return (
      <div className="tarjeta p-4 w-full space-y-3" data-ofrecer-pausa>
        <p className="font-semibold">Antes de darlo de baja: ¿le ofreciste una pausa?</p>
        <p className="texto-suave">Si se toma un tiempo, no pierde su plan ni sus días, y es más fácil que vuelva.</p>
        <div className="flex flex-wrap gap-2">
          <a href="#pausa" className="boton" onClick={() => { setAbierto(false); setMotivo(null); }}>⏸️ Ofrecerle una pausa</a>
          <button type="button" disabled={ocupado} className="boton boton-peligro" onClick={() => baja(motivo[0])}>Dar de baja igual ({motivo[1]})</button>
          <button type="button" className="boton-texto texto-suave" onClick={() => setMotivo(null)}>Volver</button>
        </div>
        {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
      </div>
    );
  }
  return (
    <div className="tarjeta p-4 w-full space-y-3">
      <p className="font-semibold">¿Por qué se va? Sirve para saber qué mejorar.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MOTIVOS.map(([v, t]) => (
          <button key={v} type="button" disabled={ocupado} className="boton"
            onClick={() => (ofrecePausa && !["mudanza", "otro_gimnasio"].includes(v) ? setMotivo([v, t]) : baja(v))}>{t}</button>
        ))}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
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
        {ocupado ? "Guardando…" : "↩️ Volver a darlo de alta"}
      </button>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </div>
  );
}

/** APP-8: el socio pidió la baja desde la app. Se habla con él: se queda, o se le da la baja con el motivo que dio. */
export function PedidoBaja({ socioId, pedido }: { socioId: string; pedido: { pedido_id: string; motivo: string; nota: string | null } }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const motivo = MOTIVOS.find(([v]) => v === pedido.motivo)?.[1] ?? pedido.motivo;
  const resolver = (baja: boolean) => empezar(async () => { const r = await resolverPedidoBaja(socioId, pedido.pedido_id, baja); setError(r.error ?? null); });
  return (
    <div className="mensaje mensaje-aviso mt-4 space-y-3" data-pedido-baja>
      <p><span className="font-semibold">👋 Pidió la baja desde la app</span> · {motivo}{pedido.nota ? `: “${pedido.nota}”` : ""}</p>
      <p className="texto-suave text-sm">Hablale antes: a veces una pausa o un cambio de plan alcanza.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} className="boton" onClick={() => resolver(false)}>💪 Se queda</button>
        <button type="button" disabled={ocupado} className="boton boton-peligro" onClick={() => resolver(true)}>Darle la baja</button>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </div>
  );
}
