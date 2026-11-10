"use client";
import { useRouter } from "next/navigation";
import { useEffect, type FormEvent } from "react";
import { META_TIPO, TIPOS_CONTROL } from "@/lib/control";
import { Icono } from "@/components/ui/Icono";

const CLAVE = "control:filtros";

export type PersonaControl = { equipo_id: string; nombre: string };

/**
 * Filtros del Control: tipo, persona y fechas. Es un formulario común (funciona aunque el JS tarde);
 * al filtrar, la pantalla se acuerda de lo último que elegiste y lo vuelve a poner la próxima vez.
 */
export function FiltrosControl({ personas, tipos, quien, desde, hasta, hoy }: {
  personas: PersonaControl[]; tipos: string[]; quien: string; desde: string; hasta: string; hoy: string;
}) {
  const ruta = useRouter();

  // Sin filtros en la dirección: se vuelve a poner lo último que se eligió.
  useEffect(() => {
    if (window.location.search) return;
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado) ruta.replace(`/panel/control?${guardado}`);
    } catch { /* sin almacenamiento: queda lo de siempre */ }
  }, [ruta]);

  function filtrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const qs = new URLSearchParams();
    for (const [k, v] of datos.entries()) if (typeof v === "string" && v) qs.append(k, v);
    const texto = qs.toString();
    try { localStorage.setItem(CLAVE, texto); } catch { /* idem */ }
    ruta.push(`/panel/control?${texto}`);
  }

  function limpiar() {
    try { localStorage.removeItem(CLAVE); } catch { /* idem */ }
    ruta.push("/panel/control");
  }

  return (
    <form onSubmit={filtrar} className="tarjeta p-4 sm:p-5 space-y-4" data-filtros-control aria-label="Filtros del control">
      <fieldset className="min-w-0">
        <legend className="etiqueta mb-2">Qué mostrar</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_CONTROL.map((t) => (
            <label key={t} className="boton boton-chico cursor-pointer has-[:checked]:border-[var(--acento)] has-[:checked]:bg-[var(--tarjeta-alta)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2">
              <input type="checkbox" name="tipos" value={t} defaultChecked={tipos.includes(t)} className="sr-only" data-tipo-filtro={t} />
              <span aria-hidden><Icono nombre={META_TIPO[t].emoji} /></span> {META_TIPO[t].etiqueta}
            </label>
          ))}
        </div>
        <p className="texto-tenue text-sm mt-2">Sin elegir ninguno se muestra todo.</p>
      </fieldset>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="min-w-0"><span className="etiqueta">Desde</span>
          <input type="date" name="desde" defaultValue={desde} max={hoy} className="campo w-full" /></label>
        <label className="min-w-0"><span className="etiqueta">Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta} max={hoy} className="campo w-full" /></label>
        <label className="col-span-2 min-w-0"><span className="etiqueta">Persona</span>
          <select name="quien" defaultValue={quien} className="campo w-full">
            <option value="">Todo el equipo</option>
            {personas.map((p) => <option key={p.equipo_id} value={p.equipo_id}>{p.nombre}</option>)}
          </select></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="boton boton-principal"><Icono nombre="buscar" /> Filtrar</button>
        <button type="button" onClick={limpiar} className="boton-texto">Limpiar filtros</button>
      </div>
    </form>
  );
}
