"use client";
// Invitados (INV-1): un socio al día trae a alguien. Nunca anónimo: nombre y DNI.
import { useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { PuntoEstado } from "@/components/panel/Estado";
import { confirmarInvitado, registrarInvitado, type Invitado } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export function Invitados({ sedeId, inicial, zona }: { sedeId: string; inicial: Invitado[]; zona: string }) {
  const [lista, setLista] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [anfitrion, setAnfitrion] = useState<ResultadoSocio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  const buscar = (t: string) => { setBusca(t); setAnfitrion(null); if (t.trim().length < 2) { setEncontrados([]); return; } void buscarSociosRapido(t).then((r) => setEncontrados(r.socios ?? [])); };
  const cerrar = () => { setAbierto(false); setNombre(""); setDni(""); setBusca(""); setAnfitrion(null); setEncontrados([]); };

  return (
    <section aria-labelledby="invitados" className="mt-8" data-invitados={lista.length}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 id="invitados" className="titulo text-2xl"><Icono nombre="usuarios" /> Invitados</h2>
        {!abierto && <button type="button" className="boton" onClick={() => { setAbierto(true); setError(null); }}><Icono nombre="mas" /> Invitado</button>}
      </div>
      {abierto && (
        <form className="tarjeta p-4 space-y-3 mb-3" data-form-invitado onSubmit={(e) => { e.preventDefault(); if (!anfitrion) { setError("Elegí al socio que lo invita."); return; }
          empezar(async () => { const r = await registrarInvitado(sedeId, anfitrion.socio_id, nombre, dni); if (r.error) setError(r.error); else { setError(null); setLista(r.invitados!); cerrar(); } }); }}>
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido del invitado" aria-label="Nombre del invitado" required />
          <input className="campo" value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" placeholder="DNI del invitado" aria-label="DNI del invitado" required />
          {anfitrion
            ? <p className="flex items-center gap-2"><PuntoEstado color={anfitrion.color} /> Lo invita <strong>{anfitrion.nombre}</strong> <button type="button" className="text-sm underline texto-suave" onClick={() => setAnfitrion(null)}>cambiar</button></p>
            : <>
                <input className="campo" value={busca} onChange={(e) => buscar(e.target.value)} placeholder="¿Qué socio lo invita?" aria-label="Socio que invita" />
                {encontrados.length > 0 && <ul className="space-y-1">{encontrados.slice(0, 5).map((s) => (
                  <li key={s.socio_id}><button type="button" className="fila !min-h-12" onClick={() => { setAnfitrion(s); setEncontrados([]); }}>
                    <PuntoEstado color={s.color} /> <span className="font-semibold">{s.nombre}</span> <span className="texto-tenue">#{s.numero}</span></button></li>
                ))}</ul>}
              </>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="boton boton-principal" disabled={ocupado}>{ocupado ? "Anotando…" : "Anotar y que pase"}</button>
            <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal mb-3"><Icono nombre="alerta" /> {error}</p>}
      {lista.length === 0 ? <p className="texto-tenue">Ningún invitado hoy.</p> : (
        <ul className="space-y-1">
          {lista.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 px-2 py-2" data-invitado={i.entro_en ? "entro" : "espera"}>
              <span className="numero text-lg w-12 texto-suave">{i.entro_en ? hora(i.entro_en) : "—"}</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold truncate">{i.nombre}</span>
                <span className="block text-sm texto-tenue truncate">DNI {i.dni} · invita {i.socio}{i.desde_la_app && !i.entro_en ? " · avisó por la app" : ""}</span></span>
              {!i.entro_en && <button type="button" className="boton" disabled={ocupado} onClick={() => empezar(async () => {
                const r = await confirmarInvitado(i.id, sedeId); if (r.error) setError(r.error); else { setError(null); setLista(r.invitados!); }
              })}><Icono nombre="ok" /> Entró</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
