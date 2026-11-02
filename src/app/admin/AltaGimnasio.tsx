"use client";
import { useActionState, useState } from "react";
import { crearGimnasio, type EstadoAlta } from "./acciones";

const aSlug = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);

export function AltaGimnasio({ dominio }: { dominio: string }) {
  const [estado, accion, creando] = useActionState<EstadoAlta, FormData>(crearGimnasio, {});
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [tocado, setTocado] = useState(false);
  return (
    <form action={accion} className="tarjeta p-5 sm:p-6 grid sm:grid-cols-2 gap-3">
      <p className="titulo text-2xl sm:col-span-2">➕ Nuevo gimnasio</p>
      <label className="space-y-1"><span className="etiqueta">Nombre</span>
        <input name="nombre" required className="campo" value={nombre} onChange={(e) => { setNombre(e.target.value); if (!tocado) setSlug(aSlug(e.target.value)); }} /></label>
      <label className="space-y-1"><span className="etiqueta">Dirección</span>
        <input name="slug" required className="campo" value={slug} onChange={(e) => { setTocado(true); setSlug(aSlug(e.target.value)); }} />
        <span className="block text-sm texto-tenue">{slug || "nombre"}.{dominio}</span></label>
      <label className="space-y-1"><span className="etiqueta">Dueño</span><input name="dueno" required className="campo" placeholder="Nombre" /></label>
      <label className="space-y-1"><span className="etiqueta">Mail del dueño</span><input name="email" type="email" className="campo" /></label>
      {estado.error && <p role="alert" className="pildora pildora-rojo sm:col-span-2 !rounded-2xl !px-4 !py-3">⚠️ {estado.error}</p>}
      {estado.ok && (
        <div role="status" className="sm:col-span-2 tarjeta !bg-[var(--tarjeta-alta)] p-4 space-y-1">
          <p>✅ {estado.ok.aviso}</p>
          <p>🌐 <a className="underline" href={`https://${estado.ok.host}`} target="_blank" rel="noopener noreferrer">{estado.ok.host}</a></p>
          {estado.ok.contrasena && <p>📧 <strong>{estado.ok.email}</strong> · 🔑 <strong className="numero text-2xl select-all">{estado.ok.contrasena}</strong></p>}
        </div>
      )}
      <div className="sm:col-span-2"><button type="submit" disabled={creando} className="boton boton-principal">{creando ? "Creando…" : "🏋️ Crear gimnasio"}</button></div>
    </form>
  );
}
