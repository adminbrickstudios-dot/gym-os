"use client";
// VD-53 · Una fila por persona con sus horas del mes; el detalle de turnos al abrirla; el dueño corrige o anula con motivo.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { ETIQUETA_ESTADO, aCampoLocal, horaLocal, textoMinutos, type Turno } from "@/lib/fichaje";
import { anularTurno, corregirTurno, guardarConfigFichaje, verPersona, type DetallePersona } from "./acciones";

export type FilaHoras = { equipo_id: string; nombre: string; rol: string; activo: boolean; turnos: number; minutos: number; sin_salida: number; en_turno: boolean };
const ROL: Record<string, string> = { recepcion: "Recepción", profe: "Profe", encargado: "Encargado" };
const dia = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export function HorasEquipo({ mes, personas, esDueno, usa, tope, zona }: { mes: string; personas: FilaHoras[]; esDueno: boolean; usa: boolean; tope: number; zona: string }) {
  return (
    <div className="space-y-6">
      {esDueno && <Ajuste usa={usa} tope={tope} />}
      {!usa && !esDueno && <Mensaje tipo="info">El gimnasio todavía no usa fichaje. Lo prende el dueño.</Mensaje>}
      {personas.length === 0
        ? <p className="texto-suave">No hay recepción, profes ni encargados en el equipo para mostrar.</p>
        : <ul className="space-y-3">{personas.map((p) => <Persona key={p.equipo_id} p={p} mes={mes} esDueno={esDueno} zona={zona} />)}</ul>}
    </div>
  );
}

function Ajuste({ usa, tope }: { usa: boolean; tope: number }) {
  const [valor, setValor] = useState(usa);
  const [horas, setHoras] = useState(String(tope));
  const [msg, setMsg] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  const guardar = (nuevoUsa: boolean, nuevoTope: string) => empezar(async () => {
    const r = await guardarConfigFichaje(nuevoUsa, Number(nuevoTope));
    if (r.error) { setMsg({ tipo: "error", texto: r.error }); setValor(usa); } else { setMsg({ tipo: "exito", texto: "Guardado." }); router.refresh(); }
  });
  return (
    <section className="tarjeta p-5 max-w-xl space-y-2" aria-labelledby="cfg-fichaje" data-config-fichaje>
      <h2 id="cfg-fichaje" className="titulo text-xl">⚙️ Fichaje del equipo</h2>
      <Interruptor etiqueta="El gimnasio usa fichaje" ayuda="La recepción y los profes marcan entrada y salida con su PIN. Apagado por defecto." checked={valor} disabled={ocupado}
        onChange={(e) => { setValor(e.target.checked); guardar(e.target.checked, horas); }} />
      <label className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">Una entrada sin salida se cierra sola a las</span>
        <input type="number" min={1} max={24} value={horas} onChange={(e) => setHoras(e.target.value)} onBlur={() => Number(horas) !== tope && guardar(valor, horas)}
          className="campo w-20 text-center" aria-label="Horas para cerrar una entrada olvidada" data-tope-horas />
        <span>horas</span>
      </label>
      <p className="texto-suave text-sm">Un turno cerrado así queda marcado “sin salida” y no suma horas hasta que lo corrijas.</p>
      {msg && <Mensaje tipo={msg.tipo}>{msg.texto}</Mensaje>}
    </section>
  );
}

function Persona({ p, mes, esDueno, zona }: { p: FilaHoras; mes: string; esDueno: boolean; zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [det, setDet] = useState<DetallePersona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  const cargar = () => empezar(async () => { const r = await verPersona(p.equipo_id, mes); if (r.detalle) { setDet(r.detalle); setError(null); } else setError(r.error ?? "No se pudo cargar"); });
  return (
    <li className="tarjeta p-4 space-y-3" data-persona={p.nombre}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="titulo text-xl">{p.nombre} <span className="texto-suave text-base font-normal">{ROL[p.rol] ?? p.rol}</span>{!p.activo && <span className="pildora ml-2 text-sm">dado de baja</span>}</h2>
        {p.en_turno && <span className="pildora pildora-verde text-sm">en turno ahora</span>}
        <span className="numero text-2xl ml-auto" data-horas>{textoMinutos(p.minutos)}</span>
      </div>
      <p className="texto-suave text-sm">{p.turnos} {p.turnos === 1 ? "turno" : "turnos"}{p.sin_salida > 0 && <> · <strong data-sin-salida>{p.sin_salida} sin salida</strong></>}</p>
      <button type="button" className="boton" aria-expanded={abierto} data-ver-turnos
        onClick={() => { const nuevo = !abierto; setAbierto(nuevo); if (nuevo) cargar(); }}>{abierto ? "Ocultar turnos" : "Ver turnos"}</button>
      {abierto && (
        <div className="space-y-2">
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          {ocupado && !det && <p className="texto-suave">Cargando…</p>}
          {det && (det.turnos.length === 0
            ? <p className="texto-suave">No fichó nada este mes.</p>
            : <ul className="divide-y divide-[var(--borde)]">{det.turnos.map((t) => (
              <Fila key={t.id} t={t} esDueno={esDueno} zona={zona} correcciones={det.correcciones.filter((c) => c.fichaje_id === t.id)}
                alCambiar={() => { cargar(); router.refresh(); }} />))}</ul>)}
        </div>)}
    </li>
  );
}

function Fila({ t, esDueno, zona, correcciones, alCambiar }: { t: Turno; esDueno: boolean; zona: string; correcciones: DetallePersona["correcciones"]; alCambiar: () => void }) {
  const [modo, setModo] = useState<null | "corregir" | "anular">(null);
  const [f, setF] = useState({ entrada: aCampoLocal(t.entrada, zona), salida: t.salida ? aCampoLocal(t.salida, zona) : "", motivo: "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const enviar = () => empezar(async () => {
    const r = modo === "anular" ? await anularTurno(t.id, f.motivo) : await corregirTurno(t.id, f.entrada, f.salida, f.motivo);
    if (r.error) setError(r.error); else { setError(null); setModo(null); alCambiar(); }
  });
  return (
    <li className="py-2 space-y-1" data-turno={t.id} data-turno-estado={t.estado}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-semibold">{dia(t.dia)}</span>
        <span>{horaLocal(t.entrada, zona)} a {t.salida ? horaLocal(t.salida, zona) : "—"}</span>
        <span className="numero ml-auto">{t.estado === "cerrado" ? textoMinutos(t.minutos) : ""}</span>
        {t.estado !== "cerrado" && <span className="pildora text-sm">{ETIQUETA_ESTADO[t.estado]}</span>}
        {t.corregido && <span className="pildora text-sm">corregido</span>}
      </div>
      {t.anulado_motivo && <p className="texto-suave text-sm">Anulado: {t.anulado_motivo}</p>}
      {correcciones.map((c, i) => (
        <p key={i} className="texto-suave text-sm">✏️ {c.por} corrigió: de {horaLocal(c.entrada_antes, zona)}–{c.salida_antes ? horaLocal(c.salida_antes, zona) : "sin salida"} a {horaLocal(c.entrada_nueva, zona)}–{horaLocal(c.salida_nueva, zona)}. “{c.motivo}”</p>
      ))}
      {esDueno && t.estado !== "anulado" && !modo && (
        <div className="flex gap-3 text-sm">
          <button type="button" className="underline" onClick={() => { setModo("corregir"); setError(null); }} data-corregir>Corregir</button>
          <button type="button" className="underline" onClick={() => { setModo("anular"); setError(null); }} data-anular>Anular</button>
        </div>)}
      {modo && (
        <div className="space-y-2 pt-1">
          {modo === "corregir" && (
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">Entrada<input type="datetime-local" value={f.entrada} onChange={(e) => setF({ ...f, entrada: e.target.value })} className="campo block" data-corr-entrada /></label>
              <label className="text-sm">Salida<input type="datetime-local" value={f.salida} onChange={(e) => setF({ ...f, salida: e.target.value })} className="campo block" data-corr-salida /></label>
            </div>)}
          <label className="text-sm block">Motivo (queda anotado)
            <input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} className="campo block w-full" data-corr-motivo /></label>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="flex gap-3">
            <button type="button" className="boton boton-principal" disabled={ocupado} onClick={enviar} data-corr-guardar>{modo === "anular" ? "Anular turno" : "Guardar corrección"}</button>
            <button type="button" className="boton" onClick={() => setModo(null)}>Cancelar</button>
          </div>
        </div>)}
    </li>
  );
}
