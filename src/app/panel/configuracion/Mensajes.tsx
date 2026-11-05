"use client";
// Pestaña Mensajes: los textos que el gimnasio le manda a sus socios (por
// WhatsApp, desde Retención, Vencen hoy y la bandeja de avisos). Cada uno se
// edita con sus variables, se ve con un socio real antes de guardar y vuelve
// al original con un toque.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarMensaje, restaurarMensaje, vistaPreviaMensaje } from "./acciones";

export type MensajePanel = {
  clave: string; titulo: string; emoji: string; cuando: string; usado_en: string[]; variables: string[];
  original: string; texto: string; modificado: boolean;
};
type Vista = { socio: string | null; situacion: string | null; texto: string; de_la_lista: boolean };

const QUE_ES: Record<string, string> = {
  nombre: "el nombre del socio", gimnasio: "el nombre del gimnasio", plan: "su plan", vence: "cuándo vence o venció",
  dias: "cuántos días", debe: "lo que tiene que pagar", monto: "lo que tiene que pagar",
};

function UnMensaje({ m, alGuardar, alCambiarSucio }: { m: MensajePanel; alGuardar: (lista: MensajePanel[]) => void; alCambiarSucio: (clave: string, sucio: boolean) => void }) {
  const [texto, setTexto] = useState(m.texto);
  const [vista, setVista] = useState<Vista | null>(null);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [msj, setMsj] = useState<{ ok?: string; error?: string; n: number }>({ n: 0 });
  const [ocupado, empezar] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const sucio = texto.trim() !== m.texto;
  useEffect(() => { alCambiarSucio(m.clave, sucio); }, [m.clave, sucio, alCambiarSucio]);

  // Vista previa con un socio real, un ratito después de dejar de escribir.
  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await vistaPreviaMensaje(m.clave, texto);
      if (r.error) { setErrorVista(r.error); return; }
      setErrorVista(null); setVista(r.vista as Vista);
    }, 400);
    return () => clearTimeout(id);
  }, [m.clave, texto]);

  const insertar = (v: string) => {
    const el = area.current;
    const ins = `{${v}}`;
    if (!el) { setTexto((t) => t + ins); return; }
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const nuevo = texto.slice(0, a) + ins + texto.slice(b);
    setTexto(nuevo);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + ins.length, a + ins.length); });
  };
  const responder = (r: { error?: string; mensajes?: unknown }, ok: string) => {
    if (r.error || !r.mensajes) { setMsj((x) => ({ error: r.error ?? "No se pudo", n: x.n + 1 })); return; }
    const lista = r.mensajes as MensajePanel[];
    const nuevo = lista.find((x) => x.clave === m.clave);
    if (nuevo) setTexto(nuevo.texto);
    alGuardar(lista);
    setMsj((x) => ({ ok, n: x.n + 1 }));
  };

  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-mensaje={m.clave} data-respuestas={msj.n}>
      <div>
        <p className="titulo text-2xl">{m.emoji} {m.titulo}</p>
        <p className="texto-suave">{m.cuando}</p>
        <p className="text-sm texto-tenue mt-1">
          {m.usado_en.length ? `Lo usás en: ${m.usado_en.join(" · ")}` : "Todavía no lo manda ninguna pantalla: queda listo para cuando la uses."}
          {m.modificado && " · Lo cambiaste"}
        </p>
      </div>
      <label className="block space-y-1">
        <span className="sr-only">Texto del mensaje {m.titulo}</span>
        <textarea ref={area} className="campo !h-auto min-h-28 py-3 leading-relaxed" maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <span className="block text-right text-sm texto-tenue">{texto.length} / 1000</span>
      </label>
      <div className="flex flex-wrap gap-2" aria-label="Variables">
        {m.variables.filter((v) => v !== "monto").map((v) => (
          <button key={v} type="button" className="pildora cursor-pointer" title={`Se reemplaza por ${QUE_ES[v] ?? v}`} onClick={() => insertar(v)}>
            {`{${v}}`} <span className="texto-tenue font-normal">{QUE_ES[v]}</span>
          </button>
        ))}
      </div>
      <div className="rounded-[var(--radio)] p-4 bg-[var(--tarjeta-alta)] space-y-2" data-vista-previa>
        <p className="text-sm texto-tenue">
          {vista?.socio ? <>Así lo recibe <b>{vista.socio}</b>{vista.situacion ? ` (${vista.situacion})` : ""}:</> : "Así se ve:"}
        </p>
        {errorVista
          ? <p className="text-sm" role="alert">⚠️ {errorVista}</p>
          : <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm px-4 py-3 max-w-prose" style={{ background: "color-mix(in oklab, var(--verde), var(--tarjeta) 78%)" }}>{vista?.texto ?? "…"}</p>}
      </div>
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !sucio && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="boton" disabled={ocupado || !sucio} onClick={() => empezar(async () => responder(await guardarMensaje(m.clave, texto), "Guardado"))}>
          {ocupado ? "Guardando…" : "✅ Guardar"}
        </button>
        {(m.modificado || texto.trim() !== m.original) && (
          <button type="button" className="boton-texto" disabled={ocupado}
            onClick={() => empezar(async () => responder(await restaurarMensaje(m.clave), "Volvió al original"))}>↩️ Volver al original</button>
        )}
        {sucio && <span className="pildora" data-sin-guardar>• Cambios sin guardar</span>}
      </div>
    </section>
  );
}

export function Mensajes({ iniciales, alCambiarSucio }: { iniciales: MensajePanel[]; alCambiarSucio: (sucio: boolean) => void }) {
  const [mensajes, setMensajes] = useState(iniciales);
  const sucios = useRef(new Set<string>());
  // Marca de "ya responde" (React tomó la pantalla): las pruebas esperan esto antes de escribir.
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  const estable = useCallback((clave: string, sucio: boolean) => {
    if (sucio) sucios.current.add(clave); else sucios.current.delete(clave);
    alCambiarSucio(sucios.current.size > 0);
  }, [alCambiarSucio]);
  return (
    <div className="space-y-4" data-mensajes data-listo={listo}>
      <p className="texto-suave">Los textos que les mandás a tus socios por WhatsApp. Las palabras entre llaves se reemplazan solas por los datos de cada socio: tocalas para sumarlas donde está el cursor.</p>
      {mensajes.map((m) => <UnMensaje key={m.clave} m={m} alGuardar={setMensajes} alCambiarSucio={estable} />)}
    </div>
  );
}
