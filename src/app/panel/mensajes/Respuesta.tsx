"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { Tilde } from "@/components/ui/Tilde";
import { ESTADOS, MAX_TEXTO, type RespuestaRapida } from "@/lib/mensajes";
import { refrescarPendientes } from "@/lib/panel/pendientes";
import { cambiarEstado, responder } from "./acciones";
import { Icono } from "@/components/ui/Icono";

/** Contestar un mensaje: con respuestas rápidas para insertar, y los botones de estado. */
export function Respuesta({ hiloId, estado, rapidas }: { hiloId: string; estado: string; rapidas: RespuestaRapida[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const enviar = async () => {
    setError(null); setHecho(null);
    const r = await responder(hiloId, texto);
    if (r.error) { setError(r.error); return; }
    setTexto(""); setHecho("Respuesta enviada. Al socio le llega el aviso.");
    refrescarPendientes(); router.refresh();
  };
  const estadoA = async (e: string) => {
    setError(null); setHecho(null);
    const r = await cambiarEstado(hiloId, e);
    if (r.error) { setError(r.error); return; }
    setHecho(e === "resuelto" ? "Marcado como resuelto." : "Estado cambiado.");
    refrescarPendientes(); router.refresh();
  };

  return (
    <div className="space-y-3" data-responder>
      {rapidas.length > 0 && (
        <div className="space-y-1">
          <p className="etiqueta">Respuestas rápidas</p>
          <div className="flex flex-wrap gap-2" data-rapidas>
            {rapidas.map((r) => (
              <button key={r.id} type="button" className="pildora cursor-pointer" title={r.texto}
                onClick={() => setTexto((t) => (t.trim() ? `${t.trimEnd()}\n${r.texto}` : r.texto).slice(0, MAX_TEXTO))}>{r.titulo}</button>
            ))}
          </div>
        </div>
      )}
      <textarea className="campo w-full min-h-28" value={texto} maxLength={MAX_TEXTO} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí la respuesta…" aria-label="Respuesta" data-texto-respuesta />
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-principal" ocupadoTexto="Enviando…" disabled={!texto.trim()} onClick={enviar} data-enviar-respuesta><Icono nombre="mensaje" /> Contestar</BotonAccion>
        {estado !== "resuelto"
          ? <BotonAccion className="boton" ocupadoTexto="Guardando…" onClick={() => estadoA("resuelto")} data-resolver><Icono nombre="ok" /> Marcar resuelto</BotonAccion>
          : <BotonAccion className="boton" ocupadoTexto="Guardando…" onClick={() => estadoA("en_curso")}><Icono nombre="deshacer" /> Volver a abrir</BotonAccion>}
        {estado === "nuevo" && <BotonAccion className="boton" ocupadoTexto="Guardando…" onClick={() => estadoA("en_curso")}><Icono nombre="reloj" /> Lo estoy viendo</BotonAccion>}
      </div>
      <p className="text-sm texto-suave">Estados: {ESTADOS.map((e) => e.titulo).join(" · ")}. Al contestar pasa a “en curso”.</p>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {hecho && <p role="status" className="aparecer flex items-center gap-2 text-[var(--verde)]"><Tilde tamano={20} />{hecho}</p>}
    </div>
  );
}
