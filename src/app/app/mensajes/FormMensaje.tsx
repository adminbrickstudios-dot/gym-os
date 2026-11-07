"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { achicarEnNavegador } from "@/lib/achicar-cliente";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { detectarSalud } from "@/lib/salud";
import { AVISO_SALUD, MAX_TEXTO, MOTIVOS, fotoValida } from "@/lib/mensajes";
import { enviarMensaje, responderAlGimnasio } from "./acciones";

/**
 * VD-38: escribirle al gimnasio. Con `hilo` sigue una conversación (sin motivo); sin `hilo` empieza una
 * (elige el motivo). La foto es opcional y se achica en el celular antes de mandarla.
 */
export function FormMensaje({ socioId, hilo, q = "", motivoInicial }: { socioId: string; hilo?: string; q?: string; motivoInicial?: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState(motivoInicial ?? "consulta");
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const enviar = async () => {
    setError(null); setAviso(null);
    if (!texto.trim()) { setError("Escribí tu mensaje"); return; }
    if (detectarSalud(texto)) return;   // VD-46H: el aviso ya está a la vista; no se envía
    const datos = new FormData();
    datos.set("texto", texto);
    if (hilo) datos.set("hilo", hilo); else { datos.set("socio", socioId); datos.set("motivo", motivo); }
    if (foto) {
      const chica = await achicarEnNavegador(foto);
      const mal = fotoValida(chica);
      if (mal) { setError(mal); return; }
      datos.set("foto", chica, foto.name.replace(/\.\w+$/, "") + (chica.type === "image/jpeg" ? ".jpg" : ""));
    }
    const r = await (hilo ? responderAlGimnasio(datos) : enviarMensaje(datos));
    if (r.error) { setError(r.error); return; }
    setTexto(""); setFoto(null); if (archivo.current) archivo.current.value = "";
    if (r.aviso) setAviso(r.aviso);
    if (!hilo && r.hilo_id) { router.push(`/app/mensajes/${r.hilo_id}${q}`); return; }
    router.refresh();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="tarjeta p-5 space-y-4" data-form-mensaje>
      {!hilo && (
        <fieldset className="space-y-2">
          <legend className="etiqueta">¿Sobre qué nos escribís?</legend>
          <div className="grid grid-cols-2 gap-2">
            {MOTIVOS.map((m) => (
              <label key={m.clave} className={`fila flex items-center gap-2 px-3 min-h-[52px] cursor-pointer ${motivo === m.clave ? "ring-2 ring-[var(--acento)]" : ""}`}>
                <input type="radio" name="motivo" value={m.clave} checked={motivo === m.clave} onChange={() => setMotivo(m.clave)} className="sr-only" data-motivo={m.clave} />
                <span aria-hidden>{m.emoji}</span><span className="font-semibold">{m.titulo}</span>
              </label>
            ))}
          </div>
          <p className="text-sm texto-suave">{MOTIVOS.find((m) => m.clave === motivo)?.ayuda}</p>
        </fieldset>
      )}
      <label className="block space-y-1">
        <span className="etiqueta">{hilo ? "Tu respuesta" : "Tu mensaje"}</span>
        <textarea className="campo w-full min-h-32" name="texto" maxLength={MAX_TEXTO} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Contanos con tus palabras…" required />
      </label>
      <div className="space-y-2">
        <label className="boton w-full cursor-pointer">
          📷 {foto ? "Cambiar la foto" : "Sumar una foto (opcional)"}
          <input ref={archivo} type="file" name="foto" accept="image/jpeg,image/png,image/webp" className="sr-only" data-foto-mensaje onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
        {foto && <p className="text-sm texto-suave break-words">📎 {foto.name} · <button type="button" className="underline" onClick={() => { setFoto(null); if (archivo.current) archivo.current.value = ""; }}>Sacar</button></p>}
      </div>
      <AvisoSalud texto={texto} />
      <p className="text-sm texto-suave" data-aviso-salud>🩺 {AVISO_SALUD}</p>
      <BotonAccion className="boton boton-principal w-full !min-h-14" ocupadoTexto="Enviando…" disabled={!texto.trim() || !!detectarSalud(texto)} onClick={enviar} data-enviar-mensaje>✉️ Enviar</BotonAccion>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {aviso && <Mensaje tipo="aviso">{aviso}</Mensaje>}
    </form>
  );
}
