"use client";
// VD-58: la agenda de los PT (cargar horarios, marcar lo dado, cancelar), reservar por un socio y los packs.
import Link from "next/link";
import { useState } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "../acciones";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { Vacio } from "@/components/ui/Vacio";
import { formatearPesos } from "@/lib/formato";
import { cancelarSesion, cargarFranjas, guardarAntelacion, guardarPack, marcarSesion, ptDelSocio, quitarFranja, reservarPorSocio, type PtSocio } from "./acciones";
import { Icono } from "@/components/ui/Icono";

type Franja = {
  franja_id: string; entrenador_id: string; entrenador: string; sede: string; inicio: string; fin: string;
  estado: "libre" | "reservada" | "dictada" | "ausente"; sesion_id: string | null; socio_id: string | null; socio: string | null; empezo: boolean;
  puede_marcar: boolean; puede_cancelar: boolean; puede_quitar: boolean; puede_quitar_con_sesion: boolean;
};
type Pack = { producto_id: string; nombre: string; precio: number; sesiones: number; validez_dias: number | null; entrenador_id: string | null; entrenador: string | null; activo: boolean; vendido: boolean };
export type DatosPt = {
  puede_gestionar: boolean; puede_reservar_por_socio: boolean; mi_equipo_id: string; mi_rol: string; horas_cancelar: number;
  sedes: { sede_id: string; nombre: string }[]; entrenadores: { equipo_id: string; nombre: string; rol: string }[];
  packs: Pack[]; franjas: Franja[]; dictadas_mes: { entrenador_id: string; nombre: string; dictadas: number; ausentes: number }[];
};

const hora = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
const diaLargo = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "long" }).format(new Date(m));
const claveDia = (m: string, zona: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(m));
const ETIQUETA = { libre: "Libre", reservada: "Reservada", dictada: "Se dio", ausente: "No vino" } as const;

function FilaFranja({ f, zona, varios }: { f: Franja; zona: string; varios: boolean }) {
  const [accion, setAccion] = useState<null | "cancelar" | "quitar">(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const correr = async (fn: () => Promise<{ error?: string }>) => { setError(null); const r = await fn(); if (r.error) setError(r.error); else { setAccion(null); setMotivo(""); } };
  return (
    <li className="tarjeta px-4 py-3 space-y-2 min-w-0" data-franja={f.franja_id} data-estado={f.estado}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="numero text-xl">{hora(f.inicio, zona)}–{hora(f.fin, zona)}</span>
        {varios && <span className="texto-suave">{f.entrenador}</span>}
        <span className="pildora" data-pildora-franja={f.estado}>{ETIQUETA[f.estado]}</span>
        {f.socio && <span className="font-semibold break-words" data-franja-socio>{f.socio_id ? <Link href={`/panel/socios/${f.socio_id}`} className="underline">{f.socio}</Link> : f.socio}</span>}
        {f.estado === "reservada" && f.empezo && <span className="texto-tenue text-sm">¿Se dio?</span>}
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {accion && (
        <div className="space-y-2 aparecer">
          <label className="block space-y-1"><span className="etiqueta">{accion === "quitar" ? "Motivo (se le avisa al socio por la app)" : "Motivo (opcional)"}</span>
            <input className="campo" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} data-franja-motivo /></label>
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" ocupadoTexto="Guardando…" data-confirmar-franja
              disabled={accion === "quitar" && f.estado === "reservada" && motivo.trim().length < 3}
              onClick={() => correr(() => accion === "quitar" ? quitarFranja(f.franja_id, motivo) : cancelarSesion(f.sesion_id!, motivo))}>
              {accion === "quitar" ? "Quitar el horario" : "Cancelar la sesión (se devuelve)"}
            </BotonAccion>
            <button type="button" className="boton" onClick={() => setAccion(null)}>Volver</button>
          </div>
        </div>
      )}
      {!accion && (
        <div className="flex flex-wrap gap-2">
          {f.puede_marcar && f.sesion_id && (
            <>
              <BotonAccion className="boton boton-principal" ocupadoTexto="…" data-marcar-dictada onClick={() => correr(() => marcarSesion(f.sesion_id!, "dictada"))}><Icono nombre="ok" /> Se dio</BotonAccion>
              <BotonAccion className="boton" ocupadoTexto="…" data-marcar-ausente onClick={() => correr(() => marcarSesion(f.sesion_id!, "ausente"))}><Icono nombre="prohibido" /> No vino</BotonAccion>
            </>
          )}
          {f.puede_cancelar && <button type="button" className="boton" onClick={() => setAccion("cancelar")} data-cancelar-sesion>Cancelar la sesión</button>}
          {(f.puede_quitar || f.puede_quitar_con_sesion) && <button type="button" className="text-sm underline texto-suave" onClick={() => setAccion("quitar")} data-quitar-franja>Quitar el horario</button>}
        </div>
      )}
    </li>
  );
}

function CargarHorarios({ datos }: { datos: DatosPt }) {
  const [pt, setPt] = useState(datos.mi_rol === "profe" ? datos.mi_equipo_id : (datos.entrenadores.find((e) => e.equipo_id === datos.mi_equipo_id)?.equipo_id ?? datos.entrenadores[0]?.equipo_id ?? ""));
  const [sede, setSede] = useState(datos.sedes[0]?.sede_id ?? "");
  const [inicio, setInicio] = useState("");
  const [minutos, setMinutos] = useState(60);
  const [semanas, setSemanas] = useState(1);
  const [msg, setMsg] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  return (
    <details className="tarjeta p-4" data-cargar-horarios>
      <summary className="cursor-pointer font-semibold"><Icono nombre="mas" /> Cargar horarios de atención</summary>
      <form className="space-y-3 mt-4" onSubmit={(e) => e.preventDefault()}>
        {datos.puede_gestionar && datos.entrenadores.length > 1 && (
          <label className="block space-y-1"><span className="etiqueta">PT</span>
            <select className="campo" value={pt} onChange={(e) => setPt(e.target.value)} data-franja-pt>{datos.entrenadores.map((e) => <option key={e.equipo_id} value={e.equipo_id}>{e.nombre}</option>)}</select></label>
        )}
        {datos.sedes.length > 1 && (
          <label className="block space-y-1"><span className="etiqueta">Sede</span>
            <select className="campo" value={sede} onChange={(e) => setSede(e.target.value)}>{datos.sedes.map((s) => <option key={s.sede_id} value={s.sede_id}>{s.nombre}</option>)}</select></label>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block space-y-1"><span className="etiqueta">Día y hora</span><input className="campo" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} data-franja-inicio /></label>
          <label className="block space-y-1"><span className="etiqueta">Dura</span>
            <select className="campo" value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} data-franja-minutos>{[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
          <label className="block space-y-1"><span className="etiqueta">Repetir</span>
            <select className="campo" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} data-franja-semanas>
              {[1, 4, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? "Solo ese día" : `Ese día de la semana, ${n} semanas`}</option>)}</select></label>
        </div>
        {msg && <Mensaje tipo={msg.tipo}>{msg.texto}</Mensaje>}
        <BotonAccion className="boton boton-principal" disabled={!inicio || !pt} ocupadoTexto="Cargando…" data-cargar-franja
          onClick={async () => { const r = await cargarFranjas(pt, sede, inicio, minutos, semanas); setMsg(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: r.cargadas === 1 ? "Horario cargado." : `${r.cargadas} horarios cargados.` }); }}>
          Cargar
        </BotonAccion>
      </form>
    </details>
  );
}

function ReservarPorSocio({ zona }: { zona: string }) {
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [socio, setSocio] = useState<ResultadoSocio | null>(null);
  const [pt, setPt] = useState<PtSocio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const cargar = async (s: ResultadoSocio) => {
    const r = await ptDelSocio(s.socio_id);
    if (r.error) { setError(r.error); return; }
    setPt(r.datos ?? null);
  };
  const buscar = async (texto: string) => {
    setBusca(texto);
    if (texto.trim().length < 2) { setEncontrados([]); return; }
    const r = await buscarSociosRapido(texto);
    setEncontrados(r.socios ?? []);
  };
  return (
    <details className="tarjeta p-4" data-reservar-por-socio>
      <summary className="cursor-pointer font-semibold"><Icono nombre="calendario" /> Reservar una sesión por un socio</summary>
      <div className="space-y-3 mt-4">
        {!socio ? (
          <>
            <input className="campo" value={busca} onChange={(e) => void buscar(e.target.value)} placeholder="Buscá al socio por nombre o DNI" aria-label="Buscar socio" data-pt-buscar-socio />
            {encontrados.length > 0 && (
              <ul className="space-y-1">{encontrados.map((s) => (
                <li key={s.socio_id}><button type="button" className="fila w-full text-left px-3 min-h-[48px]" data-pt-elegir-socio={s.socio_id}
                  onClick={() => { setSocio(s); setEncontrados([]); setError(null); setListo(null); void cargar(s); }}>{s.nombre}</button></li>
              ))}</ul>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p>Socio: <span className="font-semibold">{socio.nombre}</span> <button type="button" className="text-sm underline texto-suave" onClick={() => { setSocio(null); setPt(null); setBusca(""); }}>Cambiar</button></p>
            {error && <Mensaje tipo="error">{error}</Mensaje>}
            {listo && <Mensaje tipo="exito"><span data-pt-reservado>{listo}</span></Mensaje>}
            {pt && (
              <>
                {pt.packs && pt.packs.length > 0 ? (
                  <ul className="text-sm space-y-1">{pt.packs.map((p) => <li key={p.venta_item_id}><Icono nombre="ticket" /> {p.nombre}: le quedan {p.restantes} de {p.total}{p.vence_en ? ` (hasta el ${new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "short" }).format(new Date(new Date(p.vence_en).getTime() - 1))})` : ""}{!p.vigente ? " · no vigente" : ""}</li>)}</ul>
                ) : <p className="texto-suave text-sm">No tiene ningún pack de sesiones.</p>}
                {!pt.tiene_saldo && (
                  <p className="text-sm texto-suave">Sin sesiones disponibles: <BotonCobrar socioId={socio.socio_id} origen="otro" className="boton boton-chico"><Icono nombre="plata" /> Cobrar un pack</BotonCobrar> y volvé acá.
                    <button type="button" className="underline ml-2" onClick={() => void cargar(socio)}>Ya cobré: actualizar</button></p>
                )}
                {pt.tiene_saldo && (pt.libres?.length ?? 0) === 0 && <p className="texto-suave text-sm">No hay horarios libres en los próximos días para sus packs.</p>}
                {pt.tiene_saldo && (pt.libres?.length ?? 0) > 0 && (
                  <ul className="space-y-2 max-h-80 overflow-y-auto">{pt.libres!.map((l) => (
                    <li key={l.franja_id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 break-words"><span className="font-semibold first-letter:uppercase">{diaLargo(l.inicio, zona)}</span> · {hora(l.inicio, zona)}–{hora(l.fin, zona)} · {l.entrenador}</span>
                      <BotonAccion className="boton" ocupadoTexto="Reservando…" data-pt-reservar={l.franja_id}
                        onClick={async () => { const r = await reservarPorSocio(socio.socio_id, l.franja_id); if (r.error) { setError(r.error); setListo(null); } else { setError(null); setListo(`Reservada: ${diaLargo(l.inicio, zona)} ${hora(l.inicio, zona)} con ${l.entrenador}.`); await cargar(socio); } }}>Reservar</BotonAccion>
                    </li>
                  ))}</ul>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function Packs({ datos }: { datos: DatosPt }) {
  const [msg, setMsg] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const [nombre, setNombre] = useState("10 sesiones de PT");
  const [precio, setPrecio] = useState("");
  const [sesiones, setSesiones] = useState("10");
  const [validez, setValidez] = useState("90");
  const [pt, setPt] = useState("");
  const [horas, setHoras] = useState(String(datos.horas_cancelar));
  return (
    <details className="tarjeta p-4" data-packs-pt>
      <summary className="cursor-pointer font-semibold"><Icono nombre="ajustes" /> Packs de sesiones y cancelación</summary>
      <div className="space-y-5 mt-4">
        {msg && <Mensaje tipo={msg.tipo}>{msg.texto}</Mensaje>}
        <div className="space-y-2">
          <p className="etiqueta">Lo que vendés</p>
          {datos.packs.length === 0 && <p className="texto-suave text-sm">Todavía no hay un pack: sin pack no se pueden reservar sesiones.</p>}
          <ul className="space-y-1">{datos.packs.map((p) => (
            <li key={p.producto_id} className="text-sm" data-pack={p.producto_id}>{p.nombre} · {p.sesiones} {p.sesiones === 1 ? "sesión" : "sesiones"} · {formatearPesos(p.precio)} · {p.validez_dias ? `${p.validez_dias} días` : "sin vencimiento"} · {p.entrenador ?? "cualquier PT"}{!p.activo && " (no se ofrece)"}</li>
          ))}</ul>
          <div className="grid sm:grid-cols-3 gap-2">
            <input className="campo sm:col-span-3" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del pack" data-pack-nombre />
            <input className="campo" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio $" inputMode="decimal" aria-label="Precio" data-pack-precio />
            <input className="campo" value={sesiones} onChange={(e) => setSesiones(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Cantidad de sesiones" data-pack-sesiones />
            <input className="campo" value={validez} onChange={(e) => setValidez(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Días (vacío = sin vencer)" aria-label="Vigencia en días" />
            <select className="campo sm:col-span-2" value={pt} onChange={(e) => setPt(e.target.value)} aria-label="PT del pack"><option value="">Con cualquier PT</option>{datos.entrenadores.map((e) => <option key={e.equipo_id} value={e.equipo_id}>Solo con {e.nombre}</option>)}</select>
            <BotonAccion className="boton" ocupadoTexto="Guardando…" data-guardar-pack
              onClick={async () => { const r = await guardarPack(null, nombre, precio, Number(sesiones), validez ? Number(validez) : null, pt || null, true); setMsg(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: "Pack guardado: ya sale en Vender." }); }}>Agregar pack</BotonAccion>
          </div>
          <p className="texto-tenue text-xs">Un pack ya vendido no cambia de sesiones ni de PT: se crea otro. El pack se cobra en Vender, como cualquier producto.</p>
        </div>
        <div className="space-y-2">
          <p className="etiqueta">Cancelar con antelación</p>
          <div className="flex flex-wrap items-center gap-2">
            <input className="campo !w-24" value={horas} onChange={(e) => setHoras(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Horas de antelación" data-pt-horas />
            <span className="texto-suave">horas antes. El socio cancela hasta ahí y se le devuelve la sesión; después, lo decide el encargado.</span>
            <BotonAccion className="boton" ocupadoTexto="Guardando…" data-guardar-horas
              onClick={async () => { const r = await guardarAntelacion(Number(horas)); setMsg(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: "Antelación guardada." }); }}>Guardar</BotonAccion>
          </div>
        </div>
      </div>
    </details>
  );
}

export function Pt({ datos, zona }: { datos: DatosPt; zona: string }) {
  const varios = new Set(datos.franjas.map((f) => f.entrenador_id)).size > 1 || datos.puede_gestionar;
  const porDia = new Map<string, Franja[]>();
  for (const f of datos.franjas) { const k = claveDia(f.inicio, zona); porDia.set(k, [...(porDia.get(k) ?? []), f]); }
  const sinMarcar = datos.franjas.filter((f) => f.estado === "reservada" && f.empezo).length;
  const reservadas = datos.franjas.filter((f) => f.estado === "reservada" && !f.empezo).length;
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-3 gap-3" data-totales-pt>
        <div className="tarjeta p-3 text-center"><p className="numero text-3xl" data-total-reservadas>{reservadas}</p><p className="texto-suave text-sm">Reservadas</p></div>
        <div className="tarjeta p-3 text-center"><p className="numero text-3xl" data-total-sin-marcar>{sinMarcar}</p><p className="texto-suave text-sm">Por marcar</p></div>
        <div className="tarjeta p-3 text-center"><p className="numero text-3xl" data-total-dictadas>{datos.dictadas_mes.reduce((a, x) => a + x.dictadas, 0)}</p><p className="texto-suave text-sm">Dadas este mes</p></div>
      </div>
      {datos.dictadas_mes.length > 1 && (
        <p className="texto-suave text-sm" data-dictadas-mes>Este mes: {datos.dictadas_mes.map((x) => `${x.nombre} ${x.dictadas}`).join(" · ")}</p>
      )}
      <CargarHorarios datos={datos} />
      {datos.puede_reservar_por_socio && <ReservarPorSocio zona={zona} />}
      {datos.puede_gestionar && <Packs datos={datos} />}
      {porDia.size === 0 ? (
        <Vacio icono="pesa" titulo="Todavía no hay horarios cargados">
          Cargá los horarios en que atiende cada PT (por ejemplo, los martes a las 10 durante 8 semanas). Con un pack de sesiones, el socio reserva desde la app.
        </Vacio>
      ) : (
        <div className="space-y-5" data-agenda-pt>
          {[...porDia.entries()].map(([dia, fs]) => (
            <section key={dia} className="space-y-2" data-dia-pt={dia}>
              <h2 className="titulo text-xl first-letter:uppercase">{diaLargo(fs[0].inicio, zona)}</h2>
              <ul className="space-y-2">{fs.map((f) => <FilaFranja key={f.franja_id} f={f} zona={zona} varios={varios} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
