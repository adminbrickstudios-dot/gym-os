"use client";
// La lista de prospectos: filtros por estado, WhatsApp armado, mover de
// estado con un toque y "Hacerlo socio" (abre el alta con sus datos).
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { fechaCorta } from "@/lib/formato";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { agregarProspecto, cambiarEstado } from "./acciones";

export type Prospecto = {
  id: string; nombre: string; telefono: string; interes: string | null; origen: "pagina" | "recepcion" | "referido"; referido_por?: string | null;
  estado: "nuevo" | "contactado" | "vino" | "socio" | "no"; nota: string | null; socio_id: string | null;
  creado_en: string; actualizado_en: string; mensaje: string;
};
const ESTADOS: [Prospecto["estado"], string][] = [["nuevo", "🆕 Nuevos"], ["contactado", "💬 Contactados"], ["vino", "🏋️ Vinieron"], ["socio", "✅ Se hicieron socios"], ["no", "🚫 No les interesó"]];
const ORIGEN: Record<Prospecto["origen"], string> = { pagina: "🌐 Página", recepcion: "🛎️ Mostrador", referido: "🤝 Recomendado" };

export function Prospectos({ lista, zona, puedeAltas, pagina = null }: { lista: Prospecto[]; zona: string; puedeAltas: boolean; pagina?: string | null }) {
  const [filtro, setFiltro] = useState<Prospecto["estado"]>("nuevo");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [agregar, setAgregar] = useState(false);
  const [estadoAlta, accionAlta, agregando] = useActionState(agregarProspecto, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estadoAlta.ok) { form.current?.reset(); setAgregar(false); setFiltro("nuevo"); } }, [estadoAlta.ok]);
  const cuenta = (e: Prospecto["estado"]) => lista.filter((p) => p.estado === e).length;
  const visibles = lista.filter((p) => p.estado === filtro);
  const mover = (id: string, estado: Prospecto["estado"]) => empezar(async () => {
    const r = await cambiarEstado(id, estado); setError(r.error ?? null);
  });

  return (
    <div className="space-y-5" data-prospectos={lista.length}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado">
        {ESTADOS.map(([e, t]) => (
          <button key={e} type="button" role="tab" aria-selected={filtro === e} data-filtro={e} className="pestana" onClick={() => setFiltro(e)}>
            {t} <span className="texto-tenue">{cuenta(e)}</span>
          </button>
        ))}
      </div>

      {!agregar
        ? <button type="button" className="boton" onClick={() => setAgregar(true)}>➕ Anotar uno que preguntó</button>
        : (
          <form ref={form} action={accionAlta} className="tarjeta p-5 grid gap-3 sm:grid-cols-2" data-form-prospecto>
            <label className="block space-y-1"><span className="etiqueta">Nombre</span><input name="nombre" required maxLength={80} className="campo" autoFocus /></label>
            <label className="block space-y-1"><span className="etiqueta">WhatsApp</span><input name="telefono" required type="tel" placeholder="387 555 1234" className="campo" /></label>
            <label className="block space-y-1"><span className="etiqueta">Qué le interesa</span><input name="interes" maxLength={200} className="campo" /></label>
            <label className="block space-y-1"><span className="etiqueta">Cómo llegó</span>
              <select name="origen" className="campo"><option value="recepcion">Preguntó en el mostrador</option><option value="referido">Lo recomendó alguien</option></select></label>
            {estadoAlta.error && <Mensaje tipo="error" className="sm:col-span-2">{estadoAlta.error}</Mensaje>}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={agregando} className="boton boton-principal">{agregando ? "Guardando…" : "✅ Anotar"}</button>
              <button type="button" className="boton" onClick={() => setAgregar(false)}>Cancelar</button>
            </div>
          </form>
        )}

      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {visibles.length === 0
        ? <p className="texto-suave text-lg">{filtro === "nuevo" ? "No hay prospectos nuevos. Los que dejen sus datos en “Probá una clase” de tu página aparecen acá." : "No hay ninguno en esta lista."}</p>
        : (
          <ul className="space-y-2">
            {visibles.map((p) => {
              const wa = linkWhatsappSocio(p.telefono, pagina && p.mensaje ? `${p.mensaje}\n${pagina}` : p.mensaje);
              return (
                <li key={p.id} className="tarjeta p-4 sm:p-5 space-y-3" data-prospecto={p.estado}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-lg">{p.nombre}</p>
                    <p className="text-sm texto-tenue">{ORIGEN[p.origen]}{p.referido_por ? ` por ${p.referido_por}` : ""} · {fechaCorta(p.creado_en, zona)}</p>
                  </div>
                  {p.interes && <p className="texto-suave">“{p.interes}”</p>}
                  {p.nota && <p className="text-sm texto-tenue">📝 {p.nota}</p>}
                  <div className="flex flex-wrap gap-2">
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton boton-principal"
                      onClick={() => { if (p.estado === "nuevo") mover(p.id, "contactado"); }}>💬 Escribirle</a>}
                    {p.estado !== "socio" && p.estado !== "contactado" && <button type="button" className="boton" disabled={pendiente} onClick={() => mover(p.id, "contactado")}>💬 Ya le escribí</button>}
                    {p.estado !== "socio" && p.estado !== "vino" && <button type="button" className="boton" disabled={pendiente} onClick={() => mover(p.id, "vino")}>🏋️ Vino a probar</button>}
                    {p.estado !== "socio" && puedeAltas && (
                      <Link href={`/panel/socios/nuevo?prospecto=${p.id}`} className="boton">➕ Hacerlo socio</Link>)}
                    {p.estado !== "socio" && p.estado !== "no" && <button type="button" className="boton texto-suave" disabled={pendiente} onClick={() => mover(p.id, "no")}>🚫 No le interesó</button>}
                    {p.estado === "no" && <button type="button" className="boton" disabled={pendiente} onClick={() => mover(p.id, "nuevo")}>↩️ Volver a nuevos</button>}
                    {p.estado === "socio" && p.socio_id && puedeAltas && <Link href={`/panel/socios/${p.socio_id}`} className="boton">👤 Ver ficha</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
