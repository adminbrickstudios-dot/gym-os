"use client";
// VD-46I: cargar un incidente de la sala (sin diagnóstico) y corregirlo dentro de las 24 h.
import Link from "next/link";
import { useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "../acciones";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { detectarSalud } from "@/lib/salud";
import { corregirIncidente, crearIncidente } from "./acciones";

export type Incidente = {
  id: string; ocurrio_en: string; donde: string; que_paso: string; testigos: string | null; que_se_hizo: string;
  socio_id: string | null; socio_nombre: string | null; autor: string; creado_en: string; corregido_en: string | null; editable: boolean;
};

type Campos = { donde: string; que_paso: string; testigos: string; que_se_hizo: string };
const VACIO: Campos = { donde: "", que_paso: "", testigos: "", que_se_hizo: "" };

function CamposIncidente({ v, cambiar }: { v: Campos; cambiar: (c: Campos) => void }) {
  return (
    <div className="space-y-3">
      <label className="block space-y-1"><span className="etiqueta">¿Dónde pasó?</span>
        <input className="campo" maxLength={120} value={v.donde} onChange={(e) => cambiar({ ...v, donde: e.target.value })} placeholder="Sala de pesas, vestuario, pileta…" data-inc-donde /></label>
      <label className="block space-y-1"><span className="etiqueta">¿Qué pasó?</span>
        <textarea className="campo min-h-24" maxLength={1500} value={v.que_paso} onChange={(e) => cambiar({ ...v, que_paso: e.target.value })} placeholder="Los hechos, como los viste. Sin diagnósticos." data-inc-paso /></label>
      <label className="block space-y-1"><span className="etiqueta">Testigos (opcional)</span>
        <input className="campo" maxLength={300} value={v.testigos} onChange={(e) => cambiar({ ...v, testigos: e.target.value })} placeholder="Quién lo vio" data-inc-testigos /></label>
      <label className="block space-y-1"><span className="etiqueta">¿Qué se hizo?</span>
        <textarea className="campo min-h-20" maxLength={1000} value={v.que_se_hizo} onChange={(e) => cambiar({ ...v, que_se_hizo: e.target.value })} placeholder="Se lo sentó, se llamó a la ambulancia, se avisó a la familia…" data-inc-hizo /></label>
      <AvisoSalud texto={`${v.donde} ${v.que_paso} ${v.testigos} ${v.que_se_hizo}`} />
      <p className="text-sm texto-tenue" data-aviso-sin-diagnostico>🩺 Anotá lo que pasó y lo que se hizo, no un diagnóstico ni condiciones médicas: el sistema no guarda datos de salud.</p>
    </div>
  );
}

const completo = (v: Campos) => v.donde.trim() && v.que_paso.trim() && v.que_se_hizo.trim() && !detectarSalud(`${v.donde} ${v.que_paso} ${v.testigos} ${v.que_se_hizo}`);

export function FormIncidente({ socioInicial }: { socioInicial: { id: string; nombre: string } | null }) {
  const [abierto, setAbierto] = useState(false);
  const [v, setV] = useState<Campos>(VACIO);
  const [socio, setSocio] = useState(socioInicial);
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const buscar = async (texto: string) => {
    setBusca(texto);
    if (texto.trim().length < 2) { setEncontrados([]); return; }
    const r = await buscarSociosRapido(texto);
    setEncontrados(r.socios ?? []);
  };
  const guardar = async () => {
    setError(null); setListo(false);
    const r = await crearIncidente({ ...v, socio_id: socio?.id ?? null, ocurrio_en: null });
    if (r.error) { setError(r.error); return; }
    setV(VACIO); setSocio(null); setBusca(""); setAbierto(false); setListo(true);
  };

  if (!abierto) {
    return (
      <div className="space-y-3">
        <button type="button" className="boton boton-principal !min-h-14" onClick={() => { setAbierto(true); setListo(false); }} data-nuevo-incidente>➕ Anotar un incidente</button>
        {listo && <Mensaje tipo="exito"><span data-incidente-guardado>Incidente anotado. Se puede corregir durante las próximas 24 horas.</span></Mensaje>}
      </div>
    );
  }
  return (
    <form className="tarjeta p-5 space-y-4 aparecer" data-form-incidente onSubmit={(e) => { e.preventDefault(); }}>
      <CamposIncidente v={v} cambiar={setV} />
      <div className="space-y-2">
        <span className="etiqueta">¿Fue a un socio? (opcional)</span>
        {socio ? (
          <p className="flex flex-wrap items-center gap-2"><span className="pildora" data-inc-socio>{socio.nombre}</span>
            <button type="button" className="text-sm underline texto-suave" onClick={() => setSocio(null)}>Sacar</button></p>
        ) : (
          <>
            <input className="campo" value={busca} onChange={(e) => void buscar(e.target.value)} placeholder="Buscá por nombre o DNI" aria-label="Buscar socio" />
            {encontrados.length > 0 && (
              <ul className="space-y-1">
                {encontrados.map((s) => (
                  <li key={s.socio_id}><button type="button" className="fila w-full text-left px-3 min-h-[48px]" onClick={() => { setSocio({ id: s.socio_id, nombre: s.nombre }); setEncontrados([]); setBusca(""); }}>{s.nombre}</button></li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-principal !min-h-12" disabled={!completo(v)} onClick={guardar} ocupadoTexto="Guardando…" data-guardar-incidente>📝 Guardar incidente</BotonAccion>
        <button type="button" className="boton" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
      </div>
    </form>
  );
}

export function TarjetaIncidente({ i, zona }: { i: Incidente; zona: string }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState<Campos>({ donde: i.donde, que_paso: i.que_paso, testigos: i.testigos ?? "", que_se_hizo: i.que_se_hizo });
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  const guardar = () => empezar(async () => {
    const r = await corregirIncidente(i.id, v);
    if (r.error) { setError(r.error); return; }
    setError(null); setEditando(false);
  });
  return (
    <li className="tarjeta p-4 space-y-2 min-w-0" data-incidente={i.id}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">📍 {i.donde}</span>
        <span className="texto-tenue text-sm">{cuando(i.ocurrio_en)} · lo anotó {i.autor}</span>
        {i.corregido_en && <span className="pildora !text-xs">corregido</span>}
        {!i.editable && <span className="texto-tenue text-sm" title="Pasadas las 24 horas queda escrito y no cambia">🔒 cerrado</span>}
      </div>
      {editando ? (
        <div className="space-y-3">
          <CamposIncidente v={v} cambiar={setV} />
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" disabled={!completo(v)} onClick={guardar} ocupadoTexto="Guardando…">Guardar la corrección</BotonAccion>
            <button type="button" className="boton" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words">{i.que_paso}</p>
          <p className="texto-suave break-words"><span className="font-semibold">Se hizo:</span> {i.que_se_hizo}</p>
          {i.testigos && <p className="texto-suave text-sm break-words">👀 Testigos: {i.testigos}</p>}
          {i.socio_nombre && <p className="text-sm">👤 <Link href={`/panel/socios/${i.socio_id}`} className="underline">{i.socio_nombre}</Link></p>}
          {i.editable && <button type="button" className="text-sm underline texto-suave" onClick={() => setEditando(true)} data-corregir-incidente>Corregir</button>}
        </>
      )}
    </li>
  );
}
