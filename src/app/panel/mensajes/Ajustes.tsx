"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import type { RespuestaRapida } from "@/lib/mensajes";
import { guardarRecepcionVe, guardarRespuestaRapida, quitarRespuestaRapida } from "./acciones";
import { Icono } from "@/components/ui/Icono";

/** Solo el dueño: ¿la recepción también ve los mensajes? (dueño y encargado siempre; el profe nunca). */
export function PermisoRecepcion({ inicial, puedeEditar }: { inicial: boolean; puedeEditar: boolean }) {
  const router = useRouter();
  const [ve, setVe] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const cambiar = async (v: boolean) => {
    setVe(v); setError(null);
    const r = await guardarRecepcionVe(v);
    if (r.error) { setVe(!v); setError(r.error); } else router.refresh();
  };
  return (
    <div className="space-y-2" data-permiso-mensajes>
      <Interruptor etiqueta="La recepción también ve los mensajes" checked={ve} disabled={!puedeEditar} onChange={(e) => void cambiar(e.target.checked)}
        ayuda={puedeEditar ? "Dueño y encargado siempre los ven. El profe, nunca." : "Lo cambia el dueño."} data-permiso="recepcion_ve_mensajes" />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </div>
  );
}

/** Los textos guardados que se insertan al contestar. Los arman dueño y encargado. */
export function Rapidas({ lista, puedeEditar }: { lista: RespuestaRapida[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | "nueva" | null>(null);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abrir = (r: RespuestaRapida | null) => { setEditando(r?.id ?? "nueva"); setTitulo(r?.titulo ?? ""); setTexto(r?.texto ?? ""); setError(null); };
  const guardar = async () => {
    const r = await guardarRespuestaRapida(editando === "nueva" ? null : editando, titulo, texto);
    if (r.error) { setError(r.error); return; }
    setEditando(null); router.refresh();
  };
  const quitar = async (id: string) => { const r = await quitarRespuestaRapida(id); if (r.error) setError(r.error); else router.refresh(); };
  return (
    <details className="tarjeta p-5" data-rapidas-ajustes>
      <summary className="font-semibold cursor-pointer min-h-[44px] flex items-center"><Icono nombre="rayo" /> Respuestas rápidas ({lista.length})</summary>
      <div className="space-y-3 mt-3">
        {lista.length === 0 && <p className="texto-suave">Todavía no hay. Guardá lo que más te preguntan (“El horario de feriado es…”) y lo insertás con un toque al contestar.</p>}
        <ul className="space-y-2">
          {lista.map((r) => (
            <li key={r.id} className="flex items-start gap-2 flex-wrap">
              <span className="min-w-0 flex-1"><span className="block font-semibold">{r.titulo}</span><span className="block texto-suave text-sm break-words">{r.texto}</span></span>
              {puedeEditar && <span className="flex gap-2"><button type="button" className="boton boton-chico" onClick={() => abrir(r)}>Editar</button>
                <BotonAccion className="boton boton-chico boton-peligro" ocupadoTexto="…" onClick={() => quitar(r.id)}>Quitar</BotonAccion></span>}
            </li>
          ))}
        </ul>
        {puedeEditar && editando === null && <button type="button" className="boton" onClick={() => abrir(null)} data-nueva-rapida><Icono nombre="mas" /> Nueva respuesta rápida</button>}
        {editando !== null && (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
            <input className="campo w-full" value={titulo} maxLength={60} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre corto (ej: Horario de feriado)" aria-label="Nombre" />
            <textarea className="campo w-full min-h-24" value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} placeholder="El texto que se inserta" aria-label="Texto" />
            <div className="flex gap-2">
              <BotonAccion className="boton boton-principal" ocupadoTexto="Guardando…" disabled={!titulo.trim() || !texto.trim()} onClick={guardar}>Guardar</BotonAccion>
              <button type="button" className="boton" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </form>
        )}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
      </div>
    </details>
  );
}
