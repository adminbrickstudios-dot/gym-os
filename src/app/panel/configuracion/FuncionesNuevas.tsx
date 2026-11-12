"use client";
// N5 / N6 · Configuración → Funciones nuevas. Arriba "Qué hay de nuevo" (solo lo que este gimnasio prendió); abajo cada función con su
// interruptor (apagadas de fábrica) y, ya prendida, lo que necesita. Apagada, no aparece en ningún otro panel.
import { useEffect, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { Interruptor } from "@/components/ui/Interruptor";
import { Icono } from "@/components/ui/Icono";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import {
  cambiarFuncionNueva, cancelarAdhesionDebito, guardarAptoConfig, leerAptoConfig, leerDebito, leerFuncionesNuevas,
  type AptoConfig, type DebitoEstado, type FuncionNueva, type Novedad,
} from "./funciones-acciones";

const diaTexto = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export function FuncionesNuevas({ puedeEditar, zona }: { puedeEditar: boolean; zona: string }) {
  const [funciones, setFunciones] = useState<FuncionNueva[] | null>(null);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const aplicar = (r: { funciones?: FuncionNueva[]; novedades?: Novedad[]; error?: string }) => {
    if (r.error) { setMsj({ error: r.error }); return false; }
    setFunciones(r.funciones ?? []); setNovedades(r.novedades ?? []); return true;
  };
  useEffect(() => {
    let vivo = true;
    void leerFuncionesNuevas().then((r) => { if (vivo) aplicar(r); });
    return () => { vivo = false; };
  }, []);

  const cambiar = (f: FuncionNueva, activa: boolean) => {
    setMsj({});
    empezar(async () => {
      if (aplicar(await cambiarFuncionNueva(f.clave, activa))) setMsj({ ok: activa ? `“${f.titulo}” quedó prendida.` : `“${f.titulo}” quedó apagada: ya no aparece en ningún panel.` });
    });
  };

  return (
    <div className="space-y-6" data-funciones-nuevas={funciones === null ? "cargando" : "listo"} data-opcion="funciones-nuevas">
      <section className="tarjeta p-5 sm:p-6 space-y-3" data-que-hay-de-nuevo>
        <h2 className="titulo text-2xl"><Icono nombre="estrella" /> Qué hay de nuevo</h2>
        {funciones === null && !msj.error ? <div className="esqueleto h-16" aria-hidden />
          : novedades.length === 0 ? <p className="texto-suave" data-sin-novedades>Todavía no prendiste ninguna función nueva. Cuando prendas una, acá te contamos qué cambió, en pocas palabras.</p>
          : (
            <ul className="space-y-3">
              {novedades.map((n) => (
                <li key={n.clave} data-novedad-funcion={n.clave}>
                  <p className="font-semibold">{n.titulo} <span className="texto-tenue font-normal text-sm">· desde el {diaTexto(n.desde)}</span></p>
                  <p className="texto-suave">{n.texto}</p>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="titulo text-2xl">Funciones nuevas</h2>
          <p className="texto-suave">Vienen apagadas. Las probamos primero en un gimnasio de ensayo; prendelas cuando quieras usarlas. Apagada, una función no se ve en ninguna pantalla.</p>
        </div>
        {!puedeEditar && <p className="pildora"><Icono nombre="ojo" /> Solo el dueño prende y apaga las funciones.</p>}
        {funciones === null && !msj.error && <div className="esqueleto h-24" aria-hidden />}
        {(funciones ?? []).map((f) => (
          <div key={f.clave} className="tarjeta p-5 sm:p-6 space-y-3" data-funcion={f.clave} data-activa={f.activa ? "si" : "no"}>
            <Interruptor etiqueta={f.titulo} ayuda={f.explicacion} checked={f.activa} disabled={!puedeEditar || ocupado} aria-label={f.titulo}
              onChange={(e) => cambiar(f, e.target.checked)} />
            {f.plata && <p className="pildora pildora-amarillo whitespace-normal"><Icono nombre="plata" /> Toca cobros: probala primero en el gimnasio de ensayo.</p>}
            {f.activa && f.prendida_dia && <p className="text-sm texto-tenue">Prendida el {diaTexto(f.prendida_dia)}.</p>}
            {f.activa && f.clave === "apto_vencimiento" && <AptoConfigCard puedeEditar={puedeEditar} />}
            {f.activa && f.clave === "debito_automatico" && <DebitoCard puedeEditar={puedeEditar} zona={zona} />}
          </div>
        ))}
        {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
        {msj.ok && !msj.error && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      </section>
    </div>
  );
}

const MODOS: [AptoConfig["modo"], string, string][] = [
  ["nada", "Solo el aviso del mostrador", "Como hasta ahora: la recepción ve el aviso, la entrada no cambia."],
  ["avisa", "La entrada avisa", "El socio sin apto o con el apto por vencer pasa, en amarillo y con el aviso, también por el QR y la tablet."],
  ["frena", "La entrada frena", "Sin apto al día no pasa: sale en rojo con el motivo."],
];

function AptoConfigCard({ puedeEditar }: { puedeEditar: boolean }) {
  const [c, setC] = useState<AptoConfig | null>(null);
  const [dias, setDias] = useState(15);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerAptoConfig().then((r) => { if (!vivo) return; if (r.error) setMsj({ error: r.error }); else { setC(r.config!); setDias(r.config!.dias); } });
    return () => { vivo = false; };
  }, []);
  const guardar = (modo: string, d: number) => { setMsj({}); empezar(async () => {
    const r = await guardarAptoConfig(modo, d);
    if (r.error) setMsj({ error: r.error }); else { setC(r.config!); setDias(r.config!.dias); setMsj({ ok: "Guardado." }); }
  }); };
  return (
    <div className="space-y-3 border-t pt-3" data-apto-config={c?.modo ?? "cargando"}>
      <p className="font-semibold">Qué pasa en la entrada</p>
      {c && !c.pide_apto && <Mensaje tipo="aviso">Primero prendé “Pedir apto físico” en Configuración → Reglas. Solo se guarda hasta cuándo vale el apto, nunca el certificado.</Mensaje>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Qué hace la entrada con el apto">
        {MODOS.map(([m, t]) => (
          <button key={m} type="button" data-apto-modo={m} aria-pressed={c?.modo === m} className="pestana" disabled={!puedeEditar || ocupado || !c || (!c.pide_apto && m !== "nada")}
            onClick={() => guardar(m, dias)}>{t}</button>
        ))}
      </div>
      {c && <p className="texto-suave text-sm">{MODOS.find(([m]) => m === c.modo)?.[2]}</p>}
      <label className="flex flex-wrap items-center gap-3">
        <span className="etiqueta">Avisar desde (días antes de que venza)</span>
        <input type="number" inputMode="numeric" min={1} max={60} className="campo !w-24" data-apto-dias value={dias} disabled={!puedeEditar || ocupado || !c}
          onChange={(e) => setDias(Number(e.target.value))} />
        <button type="button" className="boton" data-apto-guardar disabled={!puedeEditar || ocupado || !c || dias === c.dias} onClick={() => guardar(c!.modo, dias)}>Guardar</button>
      </label>
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !msj.error && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </div>
  );
}

const ESTADO_ADHESION = { pendiente: "Esperando el primer cobro", activa: "Activa", pausada: "Pausada", cancelada: "Cancelada" } as const;
const ESTADO_COBRO: Record<string, string> = { acreditado: "Acreditado", rechazado: "Rechazado", sin_acreditar: "Cobrado sin acreditar: devolverlo a mano", devuelto_a_mano: "Devuelto a mano" };

function DebitoCard({ puedeEditar, zona }: { puedeEditar: boolean; zona: string }) {
  const [e, setE] = useState<DebitoEstado | null>(null);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerDebito().then((r) => { if (!vivo) return; if (r.error) setMsj({ error: r.error }); else setE(r.estado!); });
    return () => { vivo = false; };
  }, []);
  return (
    <div className="space-y-3 border-t pt-3" data-debito={e ? (e.mp_conectado ? "conectado" : "sin-mp") : "cargando"}>
      {e && !e.mp_conectado && <Mensaje tipo="aviso">Falta conectar MercadoPago (Configuración → Cobros). Sin las credenciales del gimnasio no se puede cobrar.</Mensaje>}
      {e && e.adhesiones.length === 0 && <p className="texto-suave" data-debito-vacio>Todavía no hay socios adheridos.</p>}
      {e && e.adhesiones.length > 0 && (
        <ul className="divide-y">
          {e.adhesiones.map((a) => (
            <li key={a.id} className="py-2 flex flex-wrap items-center justify-between gap-2" data-adhesion={a.estado}>
              <span className="min-w-0">
                <span className="font-semibold">{a.nombre}</span>
                <span className="texto-suave block text-sm">{formatearPesos(a.monto)} por mes · {ESTADO_ADHESION[a.estado]} · {a.cobros} {a.cobros === 1 ? "cobro" : "cobros"}{a.sin_acreditar > 0 ? ` · ${a.sin_acreditar} para devolver` : ""}</span>
              </span>
              {a.estado !== "cancelada" && puedeEditar && (
                <button type="button" className="boton" disabled={ocupado} data-cancelar-adhesion
                  onClick={() => { setMsj({}); empezar(async () => { const r = await cancelarAdhesionDebito(a.id); if (r.error) setMsj({ error: r.error }); else { setE(r.estado!); setMsj({ ok: "Adhesión cancelada." }); } }); }}>Cancelar</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {e && e.ultimos_cobros.length > 0 && (
        <div>
          <p className="font-semibold">Últimos cobros</p>
          <ul className="text-sm texto-suave">
            {e.ultimos_cobros.map((c) => <li key={c.mp_pago_id} data-cobro-debito={c.estado}>{fechaCorta(c.creado_en, zona)} · {c.nombre} · {formatearPesos(c.monto)} · {ESTADO_COBRO[c.estado] ?? c.estado}</li>)}
          </ul>
        </div>
      )}
      <p className="texto-suave text-sm">La adhesión del socio se crea contra MercadoPago con las credenciales del gimnasio: ese paso todavía no está conectado. Hoy se prueba con el simulador local.</p>
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !msj.error && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </div>
  );
}
