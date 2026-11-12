"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { PuntoEstado } from "@/components/panel/Estado";
import { asignarRutinaVarios } from "../acciones";
import { Icono } from "@/components/ui/Icono";

/** RUT-2 + VD-20: buscar socios y darles esta rutina, de a uno o de a varios, con la fecha en que conviene cambiarla. */
export function AsignarRutina({ rutinaId }: { rutinaId: string }) {
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [elegidos, setElegidos] = useState<Record<string, string>>({});
  const [hechos, setHechos] = useState<string[]>([]);
  const [cambiarEn, setCambiarEn] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    if (texto.trim().length < 2) return;
    const t = setTimeout(async () => { const r = await buscarSociosRapido(texto.trim()); setSocios(r.socios ?? []); setError(r.error ?? null); }, 200);
    return () => clearTimeout(t);
  }, [texto]);
  const ids = Object.keys(elegidos);
  const asignar = (lista: string[]) => empezar(async () => {
    setError(null); setAviso(null);
    const r = await asignarRutinaVarios(rutinaId, lista, cambiarEn || null);
    if (r.error) { setError(r.error); return; }
    setHechos((h) => [...h, ...lista]);
    setElegidos((e) => Object.fromEntries(Object.entries(e).filter(([id]) => !lista.includes(id))));
    setAviso(`Asignada a ${r.asignados} ${r.asignados === 1 ? "socio" : "socios"}${r.omitidos ? ` (${r.omitidos} no se pudo)` : ""}.`);
  });
  return (
    <section className="tarjeta p-4 sm:p-5 space-y-3" data-asignar-rutina>
      <h2 className="titulo text-2xl"><Icono nombre="persona" /> Asignar a socios</h2>
      <p className="texto-suave text-sm">La ven en su app, día por día, y anotan sus pesos. Si tenían otra, se reemplaza. Tildá varios para asignarla de una vez.</p>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <input className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar socio por nombre" aria-label="Buscar socio para asignar" />
        <label className="space-y-1"><span className="etiqueta">Cambiarla el (opcional)</span>
          <input className="campo" type="date" value={cambiarEn} onChange={(e) => setCambiarEn(e.target.value)} aria-label="Fecha de cambio" data-cambiar-en /></label>
      </div>
      {texto.trim().length >= 2 && socios.length > 0 && (
        <ul className="space-y-1">{socios.map((s) => (
          <li key={s.socio_id} className="flex items-center gap-3 min-h-[52px]">
            {hechos.includes(s.socio_id) ? <span aria-hidden className="w-5" /> : (
              <input type="checkbox" className="size-5" aria-label={`Elegir a ${s.nombre}`} checked={s.socio_id in elegidos} data-elegir-socio
                onChange={(e) => setElegidos((x) => { const n = { ...x }; if (e.target.checked) n[s.socio_id] = s.nombre; else delete n[s.socio_id]; return n; })} />
            )}
            <PuntoEstado color={s.color} />
            <span className="flex-1 min-w-0 truncate font-semibold">{s.nombre}</span>
            <Link href={`/panel/rutinas/socio?id=${s.socio_id}`} className="boton-texto texto-suave text-sm" aria-label={`Progreso de ${s.nombre}`}><Icono nombre="trofeo" /> Progreso</Link>
            {hechos.includes(s.socio_id) ? <span className="pildora pildora-verde"><Icono nombre="ok" /> Asignada</span> : (
              <button type="button" className="boton boton-chico" disabled={ocupado} onClick={() => asignar([s.socio_id])}>Asignar</button>
            )}
          </li>
        ))}</ul>
      )}
      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-elegidos={ids.length}>
          <span className="texto-suave">{ids.length === 1 ? "1 socio elegido" : `${ids.length} socios elegidos`}: {Object.values(elegidos).join(", ")}</span>
          <button type="button" className="boton boton-principal" disabled={ocupado} data-asignar-varios onClick={() => asignar(ids)}>{ocupado ? "Asignando…" : `Asignar a ${ids.length}`}</button>
        </div>
      )}
      {aviso && <p role="status" className="pildora pildora-verde whitespace-normal" data-aviso-asignada>{aviso}</p>}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
