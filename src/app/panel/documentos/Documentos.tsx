"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { archivarDocumento, firmarDocumento, guardarDocumento } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type Documento = { documento_id: string; clave: string; version: number; titulo: string; texto: string; creado_en: string; firmas: number };
const CLAVES: [string, string, string][] = [
  ["reglamento", "Reglamento", "Las reglas del gimnasio. Lo firman todos."],
  ["deslinde", "Deslinde de responsabilidad", "Que entrena bajo su responsabilidad. Lo firman todos."],
  ["menores", "Autorización del responsable", "La firma el adulto responsable de cada socio menor."],
];

/** COM-6: el dueño escribe cada texto; guardar con cambios publica una versión nueva (hay que volver a firmar). */
export function EditorDocumentos({ documentos, puedeEditar }: { documentos: Documento[]; puedeEditar: boolean }) {
  return (
    <div className="space-y-4">
      {CLAVES.map(([clave, titulo, ayuda]) => <UnDocumento key={clave} clave={clave} nombre={titulo} ayuda={ayuda} doc={documentos.find((d) => d.clave === clave) ?? null} puedeEditar={puedeEditar} />)}
    </div>
  );
}

function UnDocumento({ clave, nombre, ayuda, doc, puedeEditar }: { clave: string; nombre: string; ayuda: string; doc: Documento | null; puedeEditar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(doc?.titulo ?? nombre.replace(/^\S+ /, ""));
  const [texto, setTexto] = useState(doc?.texto ?? "");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const guardar = () => empezar(async () => {
    const r = await guardarDocumento(clave, titulo, texto);
    setMsj(r.error ? { error: r.error } : { ok: doc && doc.texto !== texto.trim() ? "Publicada la versión nueva: se la vuelve a pedir a todos." : "Guardado y publicado." });
    if (!r.error) setAbierto(false);
  });
  return (
    <section className="tarjeta p-5 space-y-3" data-documento={clave}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="titulo text-xl">{nombre}</p>
        {doc ? <span className="pildora pildora-verde">Versión {doc.version} · {doc.firmas} {doc.firmas === 1 ? "firma" : "firmas"}</span> : <span className="pildora">No se pide</span>}
      </div>
      <p className="texto-suave">{ayuda}</p>
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {abierto ? (
        <div className="space-y-3">
          <label className="block space-y-1"><span className="etiqueta">Título</span><input className="campo" maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
          <label className="block space-y-1"><span className="etiqueta">Texto que se firma</span>
            <textarea className="campo min-h-48" maxLength={8000} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
          <p className="text-sm texto-tenue">No pidas datos de salud en el texto: la firma guarda nombre, fecha y versión, nada más.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton boton-principal" disabled={ocupado} onClick={guardar}>{ocupado ? "Publicando…" : doc ? "Publicar versión nueva" : "Publicar y empezar a pedirlo"}</button>
            <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </div>
      ) : puedeEditar && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" onClick={() => setAbierto(true)}>{doc ? "Editar" : "Escribirlo"}</button>
          {doc && <button type="button" className="boton texto-suave" disabled={ocupado}
            onClick={() => empezar(async () => { const r = await archivarDocumento(clave); setMsj(r.error ? { error: r.error } : { ok: "Ya no se pide. Lo firmado queda guardado." }); })}>Dejar de pedirlo</button>}
        </div>
      )}
      {!abierto && doc && <details><summary className="cursor-pointer text-sm texto-suave">Ver el texto</summary><p className="whitespace-pre-wrap mt-2 text-sm">{doc.texto}</p></details>}
    </section>
  );
}

export type Pendiente = { documento_id: string; clave: string; titulo: string; texto: string; version: number; motivo?: string | null };

/** Firmar un documento: nombre de quien firma y el tilde de "leí y acepto". La usan la ficha (mostrador) y la app. */
export function Firmar({ socioId, doc, nombreSugerido = "", textoBoton = "Firmar" }: { socioId: string; doc: Pendiente; nombreSugerido?: string; textoBoton?: string }) {
  const [nombre, setNombre] = useState(nombreSugerido);
  const [acepto, setAcepto] = useState(false);
  const [estado, setEstado] = useState<{ ok?: boolean; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  if (estado.ok) return <Mensaje tipo="exito">Firmado: {doc.titulo}.</Mensaje>;
  return (
    <form className="tarjeta p-4 space-y-3" data-firmar={doc.clave}
      onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await firmarDocumento(doc.documento_id, socioId, nombre); setEstado(r.error ? { error: r.error } : { ok: true }); }); }}>
      <p className="font-semibold">{doc.titulo} <span className="texto-tenue font-normal">· versión {doc.version}</span></p>
      {doc.motivo === "cumplio_18" && <p className="pildora pildora-azul !rounded-2xl !px-4 !py-3 w-full" data-firma-propia><Icono nombre="persona" /> Cumplió 18: lo que firmó su responsable ya no alcanza. Ahora firma la propia persona.</p>}
      <details><summary className="cursor-pointer text-sm texto-suave">Leer el texto</summary><p className="whitespace-pre-wrap mt-2 text-sm">{doc.texto}</p></details>
      <label className="block space-y-1"><span className="etiqueta">{doc.clave === "menores" ? "Nombre y apellido del adulto responsable" : "Nombre y apellido de quien firma"}</span>
        <input className="campo" maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1.5 size-5" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} /><span>Leí y acepto {doc.titulo.toLowerCase().startsWith("el") || doc.titulo.toLowerCase().startsWith("la") ? doc.titulo.toLowerCase() : `“${doc.titulo}”`}.</span></label>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <button type="submit" className="boton boton-principal" disabled={ocupado || !acepto || nombre.trim().length < 3}>{ocupado ? "Firmando…" : textoBoton}</button>
    </form>
  );
}
