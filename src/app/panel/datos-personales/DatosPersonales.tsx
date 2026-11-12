"use client";
import { useState, useTransition } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { TERMINOS_MODELO } from "@/lib/terminos-modelo";
import { guardarPolitica, guardarTerminos, resolverPedido } from "./acciones";

export type PedidoDatos = { id: string; socio_id: string; socio: string; tipo: "ver" | "corregir" | "borrar"; detalle: string | null; creado_en: string; resuelto_en: string | null; nota: string | null };
const TIPO: Record<PedidoDatos["tipo"], string> = { ver: "Quiere ver sus datos", corregir: "Quiere corregir un dato", borrar: "Quiere que borremos sus datos" };
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const POLITICA_MODELO = `Quién es el responsable: este gimnasio.
Qué datos guardamos: tu nombre, DNI, teléfono, mail, fecha de nacimiento, tus pagos y tus entradas. No guardamos datos de salud.
Para qué los usamos: darte acceso al gimnasio, cobrarte la cuota y avisarte de tu vencimiento.
Con quién los compartimos: con nadie, salvo que una ley o un juez lo pida. Usamos servidores de Base (BRIK) para guardarlos.
Tus derechos (Ley 25.326): podés pedir ver, corregir o borrar tus datos desde tu app o en la recepción. Lo respondemos en 10 días corridos.
La Agencia de Acceso a la Información Pública (AAIP) es el organismo que atiende denuncias por incumplimiento de esta ley.`;

export type TerminosPropios = { texto: string | null; publicado: boolean; actualizado_en: string | null };

export function DatosPersonales({ politica, pedidos, puedeEditar, terminos }: { politica: string | null; pedidos: PedidoDatos[]; puedeEditar: boolean; terminos: TerminosPropios }) {
  const [texto, setTexto] = useState(politica ?? "");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [, empezar] = useTransition();
  const [textoT, setTextoT] = useState(terminos.texto ?? "");
  const [publicadoT, setPublicadoT] = useState(terminos.publicado);
  const [msjT, setMsjT] = useState<{ ok?: string; error?: string }>({});
  const abiertos = pedidos.filter((p) => !p.resuelto_en);
  const cerrados = pedidos.filter((p) => p.resuelto_en);
  return (
    <div className="space-y-8">
      <section className="tarjeta p-5 space-y-3" data-politica>
        <h2 className="titulo text-2xl">Política de privacidad</h2>
        <p className="texto-suave">La ven los socios en tu página y al anotarse. {politica ? "Está publicada con tu texto." : "Todavía no escribiste la tuya: se muestra un texto modelo."}</p>
        {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
        {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
        {puedeEditar ? (
          <>
            <textarea className="campo min-h-56" maxLength={20000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={POLITICA_MODELO} aria-label="Texto de la política de privacidad" />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="boton" onClick={() => setTexto(POLITICA_MODELO)}>Usar el texto modelo</button>
              <BotonAccion className="boton boton-principal" ocupadoTexto="Guardando…"
                onClick={async () => { const r = await guardarPolitica(texto); setMsj(r.error ? { error: r.error } : { ok: texto.trim() ? "Política publicada." : "Se quitó tu texto: se muestra el modelo." }); }}>Guardar y publicar</BotonAccion>
            </div>
          </>
        ) : <p className="whitespace-pre-wrap text-sm">{politica ?? POLITICA_MODELO}</p>}
        <p className="text-sm texto-tenue">Inscribir la base de datos en la AAIP (Registro Nacional de Bases de Datos) lo hace el gimnasio como responsable: no lo hace Base por vos. El texto modelo es un borrador: revisalo con un abogado.</p>
      </section>

      <section className="tarjeta p-5 space-y-3" data-terminos-panel>
        <h2 className="titulo text-2xl">Términos y condiciones</h2>
        <p className="texto-suave">Las reglas de tu gimnasio: cuota, pausas, bajas, uso de las instalaciones. {publicadoT ? "Están publicados en tu página, en /terminos." : "No están publicados: nadie los ve hasta que los publiques."}</p>
        {msjT.ok && <Mensaje tipo="exito">{msjT.ok}</Mensaje>}
        {msjT.error && <Mensaje tipo="error">{msjT.error}</Mensaje>}
        {puedeEditar ? (
          <>
            <textarea className="campo min-h-56" maxLength={20000} value={textoT} onChange={(e) => setTextoT(e.target.value)} placeholder={TERMINOS_MODELO} aria-label="Texto de los términos y condiciones" />
            <label className="flex items-center gap-2"><input type="checkbox" checked={publicadoT} onChange={(e) => setPublicadoT(e.target.checked)} /> Publicar en mi página</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="boton" onClick={() => setTextoT(TERMINOS_MODELO)}>Empezar desde el texto modelo</button>
              <BotonAccion className="boton boton-principal" ocupadoTexto="Guardando…"
                onClick={async () => { const r = await guardarTerminos(textoT, publicadoT); setMsjT(r.error ? { error: r.error } : { ok: publicadoT ? "Términos publicados." : "Términos guardados, sin publicar." }); }}>Guardar</BotonAccion>
            </div>
          </>
        ) : <p className="whitespace-pre-wrap text-sm">{terminos.texto ?? "Todavía no hay términos cargados."}</p>}
        <p className="text-sm texto-tenue">El texto modelo es un borrador para que lo adaptes: no es asesoramiento legal. Revisalo con un abogado antes de publicarlo.</p>
      </section>

      <section className="space-y-3" data-pedidos-datos>
        <h2 className="titulo text-2xl">Pedidos de socios {abiertos.length > 0 && <span className="pildora pildora-amarillo">{abiertos.length} sin resolver</span>}</h2>
        {abiertos.length === 0 && <p className="texto-suave">Nadie pidió ver, corregir ni borrar sus datos.</p>}
        <ul className="space-y-3">{abiertos.map((p) => <Pedido key={p.id} p={p} />)}</ul>
        {cerrados.length > 0 && (
          <details><summary className="cursor-pointer texto-suave">Resueltos (últimos 90 días)</summary>
            <ul className="tarjeta divide-y divide-[var(--borde)] mt-2">{cerrados.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm"><b>{p.socio}</b> · {TIPO[p.tipo]} · resuelto el {dia(p.resuelto_en!)}<br /><span className="texto-suave">{p.nota}</span></li>
            ))}</ul>
          </details>
        )}
      </section>
    </div>
  );

  function Pedido({ p }: { p: PedidoDatos }) {
    const [nota, setNota] = useState("");
    const [error, setError] = useState<string | null>(null);
    return (
      <li className="tarjeta p-4 space-y-2" data-pedido={p.tipo}>
        <p><b>{p.socio}</b> · {TIPO[p.tipo]} <span className="texto-suave text-sm">· {dia(p.creado_en)}</span></p>
        {p.detalle && <p className="texto-suave">“{p.detalle}”</p>}
        {p.tipo === "borrar" && <p className="text-sm texto-tenue">Los pagos y las entradas se guardan por obligación contable: se anonimiza la ficha, no se borran los hechos.</p>}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <div className="flex flex-wrap gap-2">
          <input className="campo flex-1 min-w-56" maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Qué se hizo (por ejemplo: se corrigió el teléfono)" aria-label="Qué se hizo" />
          <BotonAccion className="boton boton-principal" ocupadoTexto="Guardando…"
            onClick={async () => { const r = await resolverPedido(p.id, nota); if (r.error) setError(r.error); else empezar(() => setError(null)); }}>Marcar resuelto</BotonAccion>
        </div>
      </li>
    );
  }
}
