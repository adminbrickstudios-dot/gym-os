"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { crearGimnasio, type EstadoAlta } from "./acciones";
import { BotonEntrar } from "./BotonEntrar";

// ADM-1: el tipo de gimnasio prende lo que corresponde y crea planes de ejemplo (sin precio).
const TIPOS: [string, string][] = [
  ["", "Sin plantilla (todo apagado)"], ["musculacion", "🏋️ Musculación de barrio"], ["grande", "🏢 Gimnasio grande o cadena"],
  ["box", "🔥 Box de crossfit o funcional"], ["yoga", "🧘 Yoga o pilates"], ["artes", "🥋 Artes marciales o escuela deportiva"],
  ["natacion", "🏊 Natación"], ["personal", "💪 Entrenador personal o estudio chico"], ["24h", "🌙 24 horas o sin recepción"],
];
const aSlug = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);

export function AltaGimnasio({ dominio }: { dominio: string }) {
  const [estado, accion, creando] = useActionState<EstadoAlta, FormData>(crearGimnasio, {});
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [tocado, setTocado] = useState(false);
  const ok = estado.ok;
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4">
      <p className="titulo text-2xl">➕ Nuevo gimnasio</p>
      {ok ? (
        <div role="status" className="space-y-4">
          <p className="text-lg">✅ <strong>{ok.nombre}</strong> está creado. {ok.aviso}</p>
          {ok.contrasena && (
            <div className="tarjeta !bg-[var(--tarjeta-alta)] p-4 space-y-1">
              <p className="texto-suave text-sm">Acceso del dueño (se muestra una sola vez)</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <span>📧 <strong className="break-all">{ok.email}</strong></span>
                <span>🔑 <strong className="numero text-2xl select-all">{ok.contrasena}</strong></span>
              </p>
              <p className="texto-tenue text-sm">Entra en la misma dirección que vos, con “Entrá a tu gimnasio”.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <BotonEntrar gimnasioId={ok.gimnasio_id} />
            <Link href={`/admin/${ok.gimnasio_id}`} className="boton">⚙️ Equipo, claves y direcciones</Link>
            <a href={`/g/${ok.slug}`} target="_blank" rel="noopener noreferrer" className="boton">🌐 Ver su página</a>
            <button type="button" className="boton texto-suave" onClick={() => window.location.reload()}>➕ Crear otro</button>
          </div>
        </div>
      ) : (
        <form action={accion} className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1"><span className="etiqueta">Nombre del gimnasio</span>
            <input name="nombre" required className="campo" value={nombre} placeholder="Olympo Gym"
              onChange={(e) => { setNombre(e.target.value); if (!tocado) setSlug(aSlug(e.target.value)); }} /></label>
          <label className="space-y-1"><span className="etiqueta">Dirección</span>
            <input name="slug" required className="campo" value={slug} placeholder="olympo-gym"
              onChange={(e) => { setTocado(true); setSlug(aSlug(e.target.value)); }} />
            <span className="block text-sm texto-tenue break-all">{slug || "nombre"}.{dominio || "(falta el dominio)"}</span></label>
          <label className="space-y-1"><span className="etiqueta">Nombre del dueño</span><input name="dueno" required className="campo" placeholder="Nombre y apellido" /></label>
          <label className="space-y-1"><span className="etiqueta">Mail del dueño</span>
            <input name="email" type="email" className="campo" placeholder="Para crearle la cuenta" />
            <span className="block text-sm texto-tenue">Si lo dejás vacío, le das acceso después.</span></label>
          <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Tipo de gimnasio</span>
            <select name="tipo" className="campo" defaultValue="musculacion">{TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            <span className="block text-sm texto-tenue">Prende las clases y lo que cobra, y deja planes de ejemplo sin precio: el dueño los ajusta.</span></label>
          {estado.error && <p role="alert" className="pildora pildora-rojo sm:col-span-2 !rounded-2xl !px-4 !py-3">⚠️ {estado.error}</p>}
          <div className="sm:col-span-2"><button type="submit" disabled={creando} className="boton boton-principal">{creando ? "Creando…" : "🏋️ Crear gimnasio"}</button></div>
        </form>
      )}
    </section>
  );
}
