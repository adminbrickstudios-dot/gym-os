"use client";
// Logo, ícono y fotos: subir, cambiar, quitar y ordenar. Lo que decide si se
// puede (tipo, tamaño, cupo, permiso) es la base; acá se avisa antes para no
// hacer esperar una subida que va a rebotar.
import { useRef, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { urlMarca } from "@/lib/url-marca";
import { ordenarFotos, quitarImagen, subirImagen } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type TipoImagen = "logo" | "favicon" | "foto";
export type Reglas = { tipos: string[]; max_bytes: number; maximo?: number };
export type Imagenes = { logo_path: string | null; favicon_path: string | null; fotos: string[] };
type Resultado = { error?: string; datos?: unknown };

const NOMBRE_TIPOS: Record<string, string> = { "image/png": "PNG", "image/jpeg": "JPG", "image/webp": "WEBP", "image/svg+xml": "SVG" };
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(n / 1024)} KB`);
export const textoReglas = (r: Reglas) => `${r.tipos.map((t) => NOMBRE_TIPOS[t] ?? t).join(", ")} · hasta ${kb(r.max_bytes)}`;

/** Lo que se puede decir sin subir nada. */
function problemaArchivo(f: File, r: Reglas): string | null {
  if (f.type && !r.tipos.includes(f.type)) return `“${f.name}” no sirve: tiene que ser ${r.tipos.map((t) => NOMBRE_TIPOS[t] ?? t).join(", ")}.`;
  if (f.size > r.max_bytes) return `“${f.name}” pesa ${kb(f.size)} y el máximo es ${kb(r.max_bytes)}. Achicalo (por ejemplo con squoosh.app) y probá de nuevo.`;
  if (f.size === 0) return `“${f.name}” está vacío.`;
  return null;
}

function useAccion(alListo: (d: Imagenes) => void) {
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const correr = (fn: () => Promise<Resultado>, exito: string) => {
    setError(null); setOk(null);
    empezar(async () => {
      const r = await fn();
      if (r.error || !r.datos) { setError(r.error ?? "No se pudo"); return; }
      alListo(r.datos as Imagenes);
      setOk(exito);
    });
  };
  return { ocupado, error, ok, setError, correr };
}

const subir = (tipo: TipoImagen, f: File) => {
  const fd = new FormData();
  fd.set("tipo", tipo); fd.set("archivo", f);
  return subirImagen(fd);
};

/** Logo o ícono: una sola imagen, con su vista previa. */
export function UnaImagen({ tipo, ruta, reglas, puedeEditar, alListo, vista }: {
  tipo: "logo" | "favicon"; ruta: string | null; reglas: Reglas; puedeEditar: boolean; alListo: (d: Imagenes) => void;
  vista: (url: string | null) => React.ReactNode;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const { ocupado, error, ok, setError, correr } = useAccion(alListo);
  const nombre = tipo === "logo" ? "logo" : "ícono";
  // BASE-7: vista previa ANTES de guardar. Elegir un archivo lo muestra como se va a ver; recién "Usar este" lo sube.
  const [pendiente, setPendiente] = useState<{ archivo: File; url: string } | null>(null);
  const descartar = () => { if (pendiente) URL.revokeObjectURL(pendiente.url); setPendiente(null); };
  const elegir = (f: File | undefined) => {
    if (!f) return;
    const mal = problemaArchivo(f, reglas);
    if (mal) { setError(mal); return; }
    setError(null); descartar();
    setPendiente({ archivo: f, url: URL.createObjectURL(f) });
  };
  const usar = () => {
    if (!pendiente) return;
    const f = pendiente.archivo;
    descartar();
    correr(() => subir(tipo, f), tipo === "logo" ? "Logo listo" : "Ícono listo");
  };
  return (
    <div className="space-y-3" data-imagen={tipo}>
      {vista(pendiente ? pendiente.url : urlMarca(ruta))}
      {pendiente && (
        <div className="flex flex-wrap items-center gap-2" data-vista-previa={tipo}>
          <span className="texto-suave">Así se va a ver. ¿Lo usamos?</span>
          <button type="button" className="boton boton-principal" disabled={ocupado} onClick={usar}>{ocupado ? "Subiendo…" : `Usar este ${nombre}`}</button>
          <button type="button" className="boton-texto" disabled={ocupado} onClick={descartar}>Elegir otro</button>
        </div>
      )}
      {puedeEditar && !pendiente && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={entrada} type="file" accept={reglas.tipos.join(",")} className="sr-only" aria-label={`Elegir ${nombre}`}
            onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="boton" disabled={ocupado} onClick={() => entrada.current?.click()}>
            {ocupado ? "Subiendo…" : ruta ? `Cambiar ${nombre}` : `Subir ${nombre}`}
          </button>
          {ruta && <button type="button" className="boton-texto" disabled={ocupado} onClick={() => correr(() => quitarImagen(tipo), "Listo, sin " + nombre)}>Quitar</button>}
          <span className="text-sm texto-tenue">{textoReglas(reglas)}</span>
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {ok && !error && <Mensaje tipo="exito">{ok}</Mensaje>}
    </div>
  );
}

/** Fotos de la página: hasta el máximo, se suman varias juntas, se ordenan y se quitan. */
export function Fotos({ fotos, reglas, puedeEditar, nombre, alListo }: {
  fotos: string[]; reglas: Reglas; puedeEditar: boolean; nombre: string; alListo: (d: Imagenes) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const { ocupado, error, ok, setError, correr } = useAccion(alListo);
  const maximo = reglas.maximo ?? 12;
  const lugar = maximo - fotos.length;
  const elegir = (lista: FileList | null) => {
    const archivos = [...(lista ?? [])];
    if (!archivos.length) return;
    if (archivos.length > lugar) { setError(`Elegiste ${archivos.length} fotos y queda lugar para ${lugar}. Quitá alguna o elegí menos.`); return; }
    for (const f of archivos) { const mal = problemaArchivo(f, reglas); if (mal) { setError(mal); return; } }
    correr(async () => {
      let ultimo: Resultado = {};
      for (const f of archivos) { ultimo = await subir("foto", f); if (ultimo.error) return ultimo; }
      return ultimo;
    }, archivos.length === 1 ? "Foto sumada" : `${archivos.length} fotos sumadas`);
  };
  const mover = (i: number, a: number) => {
    const nuevo = [...fotos];
    [nuevo[i], nuevo[a]] = [nuevo[a], nuevo[i]];
    correr(() => ordenarFotos(nuevo), "Orden guardado");
  };
  return (
    <div className="space-y-3" data-fotos={fotos.length}>
      {fotos.length === 0
        ? <p className="texto-tenue">Todavía no hay fotos. Las que subas aparecen en tu página, en la sección de fotos.</p>
        : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {fotos.map((f, i) => (
              <li key={f} className="space-y-2" data-foto={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlMarca(f) ?? ""} alt={`Foto ${i + 1} de ${nombre}`} loading="lazy"
                  className="w-full aspect-square object-cover rounded-[var(--radio)] border border-[var(--borde)]" />
                {puedeEditar && (
                  <div className="flex items-center gap-1">
                    <button type="button" className="boton boton-chico !px-3" aria-label={`Mover la foto ${i + 1} antes`} disabled={ocupado || i === 0} onClick={() => mover(i, i - 1)}><Icono nombre="izquierda" /></button>
                    <button type="button" className="boton boton-chico !px-3" aria-label={`Mover la foto ${i + 1} después`} disabled={ocupado || i === fotos.length - 1} onClick={() => mover(i, i + 1)}><Icono nombre="derecha" /></button>
                    <button type="button" className="boton-texto ml-auto" aria-label={`Quitar la foto ${i + 1}`} disabled={ocupado} onClick={() => correr(() => quitarImagen("foto", f), "Foto quitada")}><Icono nombre="papelera" /> Quitar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={entrada} type="file" multiple accept={reglas.tipos.join(",")} className="sr-only" aria-label="Elegir fotos"
            onChange={(e) => { elegir(e.target.files); e.target.value = ""; }} />
          <button type="button" className="boton" disabled={ocupado || lugar <= 0} onClick={() => entrada.current?.click()}>
            {ocupado ? "Guardando…" : "Sumar fotos"}
          </button>
          <span className="text-sm texto-tenue">{fotos.length} de {maximo} · {textoReglas(reglas)}</span>
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {ok && !error && <Mensaje tipo="exito">{ok}</Mensaje>}
    </div>
  );
}
