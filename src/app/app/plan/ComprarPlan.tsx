"use client";
// VD-39 · Cambiar de plan o comprar un pase / pack desde la app. Todo lo calcula la base (días a favor,
// precios por medio); acá se elige, se mira y se paga. Cada intento de pago lleva su clave de operación:
// un doble toque es un solo pago.
import { useRef, useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { informarCompraApp, pagarConMercadoPago, vistaCompraApp, type VistaCompra } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type PlanOferta = {
  plan_id: string; nombre: string; tipo: "membresia" | "pase_diario" | "pack"; descripcion: string | null;
  cantidad_clases: number | null; validez_dias: number | null; duracion_meses: number | null;
  precio_transferencia: number | null; precio_mercadopago: number | null;
};
export type OpcionesCompra = {
  habilitado: boolean; plan_actual: { plan_id: string; nombre: string } | null;
  transferencia: { alias: string | null; cbu: string | null; titular: string | null; banco?: string | null } | null;
  mercadopago: boolean; planes: PlanOferta[];
  pendiente: { descripcion: string; monto: number; medio: string; desde: string } | null;
};

const TITULOS = { membresia: "Cambiar de plan", pase_diario: "Pases por día", pack: "Packs de clases" } as const;
const precioMin = (p: PlanOferta) => [p.precio_transferencia, p.precio_mercadopago].filter((x): x is number => x != null).sort((a, b) => a - b)[0] ?? null;

export function ComprarPlan({ socioId, gimnasioId, opciones }: { socioId: string; gimnasioId: string; opciones: OpcionesCompra }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaCompra | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [viendo, empezarVista] = useTransition();
  const [subiendo, empezarSubida] = useTransition();
  const [copiado, setCopiado] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const claves = useRef(new Map<string, string>());
  const claveDe = (plan: string, medio: string) => {
    const k = `${plan}:${medio}`;
    if (!claves.current.has(k)) claves.current.set(k, crypto.randomUUID());
    return claves.current.get(k)!;
  };

  const elegir = (p: PlanOferta) => {
    setElegido(p.plan_id); setVista(null); setError(null); setListo(null);
    empezarVista(async () => {
      const r = await vistaCompraApp(socioId, p.plan_id);
      if (r.error || !r.vista) { setError(r.error ?? "No se pudo calcular"); return; }
      setVista(r.vista);
    });
  };
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopiado(t); setTimeout(() => setCopiado(null), 1500); } catch { setCopiado(null); } };

  const pagarMP = async () => {
    if (!vista) return;
    setError(null);
    const r = await pagarConMercadoPago(socioId, claveDe(vista.plan_id, "mp"), vista.plan_id);
    if (r.error || !r.url) { setError(r.error ?? "No se pudo abrir MercadoPago"); return; }
    window.location.assign(r.url);
  };
  const subir = (f: File) => {
    if (!vista) return;
    empezarSubida(async () => {
      setError(null);
      if (f.size > 5 * 1024 * 1024) { setError("El archivo pesa más de 5 MB"); return; }
      const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${gimnasioId}/${socioId}/${crypto.randomUUID()}.${ext}`;
      const { error: e } = await crearClienteNavegador().storage.from("comprobantes").upload(path, f, { contentType: f.type });
      if (e) { setError("No se pudo subir el comprobante. Revisá tu conexión y probá de nuevo."); return; }
      const r = await informarCompraApp(socioId, vista.plan_id, path, claveDe(vista.plan_id, "transferencia"));
      if (r.error) { setError(r.error); return; }
      setListo(vista.cambia_plan ? "Listo: el gimnasio revisa tu comprobante y, apenas lo aprueba, tu plan cambia." : "Listo: el gimnasio revisa tu comprobante y te habilita.");
    });
  };

  const o = opciones;
  if (!o.habilitado) {
    return <div className="tarjeta p-5 space-y-2" data-compra-apagada><p className="titulo text-2xl"><Icono nombre="campana" /> Pasá por recepción</p>
      <p className="texto-suave">Para cambiar de plan o comprar un pase, hablá con el gimnasio.</p></div>;
  }
  const grupos = (["membresia", "pase_diario", "pack"] as const).map((t) => [t, o.planes.filter((p) => p.tipo === t)] as const).filter(([, l]) => l.length > 0);
  const sinMedios = !o.mercadopago && !o.transferencia;

  return (
    <div className="space-y-6" data-comprar-plan>
      {o.pendiente && (
        <Mensaje tipo="info"><span data-compra-pendiente>Tenés un pago esperando que el gimnasio lo apruebe: <b>{o.pendiente.descripcion}</b> ({formatearPesos(o.pendiente.monto)}).</span></Mensaje>
      )}
      {sinMedios && <Mensaje tipo="aviso">El gimnasio todavía no tiene pagos online ni datos de transferencia: pasá por recepción para pagar.</Mensaje>}
      {grupos.length === 0 && <div className="tarjeta p-5" data-compra-vacio><p className="titulo text-xl">No hay otros planes a la venta</p><p className="texto-suave">Cuando el gimnasio sume planes o pases, los vas a poder comprar desde acá.</p></div>}
      {grupos.map(([tipo, lista]) => (
        <section key={tipo} className="space-y-2" aria-label={TITULOS[tipo]}>
          <h2 className="titulo text-2xl">{TITULOS[tipo]}</h2>
          <ul className="space-y-2">
            {lista.map((p) => {
              const precio = precioMin(p);
              return (
                <li key={p.plan_id}>
                  <button type="button" onClick={() => elegir(p)} aria-pressed={elegido === p.plan_id} data-plan-oferta={p.nombre}
                    className={`tarjeta w-full text-left flex items-center gap-3 px-5 py-4 min-h-[68px] border-2 ${elegido === p.plan_id ? "border-[var(--acento)]" : "border-transparent"}`}>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-lg truncate">{p.nombre}</span>
                      <span className="block texto-suave text-sm">
                        {p.tipo === "pack" ? `${p.cantidad_clases} clases${p.validez_dias ? ` · ${p.validez_dias} días` : ""}` : p.tipo === "pase_diario" ? "Un día" : p.duracion_meses && p.duracion_meses > 1 ? `Cada ${p.duracion_meses} meses` : "Por mes"}
                        {p.descripcion ? ` · ${p.descripcion}` : ""}
                      </span>
                    </span>
                    {precio != null && <span className="numero text-xl flex-none">{formatearPesos(precio)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {elegido && (
        <section className="tarjeta p-5 space-y-4 aparecer" aria-live="polite" data-detalle-compra>
          {viendo && <p className="texto-suave">Calculando…</p>}
          {vista && (
            <>
              <p className="titulo text-2xl">{vista.cambia_plan ? `Pasarte a ${vista.nombre}` : `${vista.nombre}`}</p>
              {vista.cambia_plan && (
                <div className="space-y-1" data-dias-a-favor>
                  {vista.plan_viejo && (vista.dias_a_favor ?? 0) > 0
                    ? <p>Te quedan <b className="numero">{vista.dias_a_favor}</b> {vista.dias_a_favor === 1 ? "día" : "días"} a favor de {vista.plan_viejo}{vista.hasta ? <> (pagos hasta el {vista.hasta.slice(8, 10)}/{vista.hasta.slice(5, 7)})</> : null}: se suman a tu plan nuevo.</p>
                    : <p className="texto-suave">No te quedan días a favor del plan anterior: el plan nuevo arranca hoy.</p>}
                  {vista.congelado && <Mensaje tipo="aviso">Tenés un congelamiento en curso: resolvelo con el gimnasio antes de cambiar de plan.</Mensaje>}
                  <p className="texto-tenue text-sm">Tu plan cambia cuando se acredita el pago.</p>
                </div>
              )}
              {!vista.cambia_plan && vista.tipo === "pase_diario" && <p className="texto-suave">Vale por un día de entrenamiento.</p>}
              {!vista.cambia_plan && vista.tipo === "pack" && <p className="texto-suave">{vista.cantidad_clases} clases{vista.validez_dias ? `, para usar en ${vista.validez_dias} días` : ""}.</p>}

              {listo
                ? <Mensaje tipo="exito"><span data-compra-lista>{listo}</span></Mensaje>
                : (
                  <div className="space-y-4">
                    {o.mercadopago && vista.precio_mercadopago != null && (
                      <div className="space-y-2" data-pago-mp>
                        <p><span className="numero text-3xl">{formatearPesos(vista.precio_mercadopago)}</span> <span className="texto-suave">con MercadoPago</span></p>
                        <BotonAccion className="boton boton-principal w-full text-lg" ocupadoTexto="Abriendo MercadoPago…" onClick={pagarMP} disabled={vista.congelado}>Pagar con MercadoPago</BotonAccion>
                      </div>
                    )}
                    {o.transferencia && vista.precio_transferencia != null && (
                      <div className="space-y-2" data-pago-transferencia>
                        <p><span className="numero text-3xl">{formatearPesos(vista.precio_transferencia)}</span> <span className="texto-suave">por transferencia</span></p>
                        {[["Alias", o.transferencia.alias], ["CBU / CVU", o.transferencia.cbu]].filter(([, v]) => v).map(([k, v]) => (
                          <button key={k} type="button" onClick={() => copiar(v!)} className="boton w-full !justify-between">
                            <span className="text-left"><span className="block text-[13px] texto-tenue">{k}</span><span className="block font-semibold break-all">{v}</span></span>
                            <span className="text-sm texto-suave">{copiado === v ? <><Icono nombre="ok" /> Copiado</> : <><Icono nombre="lista" /> Copiar</>}</span>
                          </button>
                        ))}
                        {(o.transferencia.titular || o.transferencia.banco) && <p className="texto-suave text-sm">{[o.transferencia.titular && `A nombre de ${o.transferencia.titular}`, o.transferencia.banco].filter(Boolean).join(" · ")}</p>}
                        <input ref={archivo} type="file" accept="image/*,application/pdf" className="hidden" data-comprobante-compra onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
                        <button type="button" disabled={subiendo || vista.congelado || !!o.pendiente} onClick={() => archivo.current?.click()} className="boton w-full text-lg">
                          {subiendo ? "Subiendo…" : <><Icono nombre="camara" /> Ya transferí: subir comprobante</>}
                        </button>
                        {o.pendiente && <p className="texto-tenue text-sm">Ya tenés un comprobante esperando: cuando lo aprueben, podés mandar otro.</p>}
                      </div>
                    )}
                  </div>
                )}
            </>
          )}
          {error && <Mensaje tipo="error">{error}</Mensaje>}
        </section>
      )}
    </div>
  );
}
