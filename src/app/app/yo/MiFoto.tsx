"use client";
// FA-16: "Mi foto". Se elige o se saca con la cámara del celular (capture="user"), se recorta cuadrada y se achica a 480 px acá, y la sube el servidor.
import { useRef, useState, useTransition } from "react";
import { subirMiFoto } from "./foto-acciones";

const LADO = 480;

async function aJpg(archivo: File): Promise<Blob> {
  const img = await createImageBitmap(archivo);
  const c = document.createElement("canvas");
  c.width = LADO; c.height = LADO;
  const lado = Math.min(img.width, img.height);
  c.getContext("2d")!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo armar la foto"))), "image/jpeg", 0.85));
}

export function MiFoto({ socioId, iniciales, tieneFoto }: { socioId: string; iniciales: string; tieneFoto: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [subiendo, empezar] = useTransition();

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    let jpg: Blob;
    try { jpg = await aJpg(archivo); } catch { setError("No se pudo leer esa imagen. Probá con otra (JPG o PNG)."); return; }
    setVista(URL.createObjectURL(jpg));
    empezar(async () => {
      const f = new FormData(); f.set("foto", new File([jpg], "foto.jpg", { type: "image/jpeg" }));
      const r = await subirMiFoto(socioId, f);
      if (r.error) { setError(r.error); setVista(null); }
    });
  };

  return (
    <div className="tarjeta p-5 flex items-center gap-4" data-mi-foto={tieneFoto || vista ? "si" : "no"}>
      <span className="size-20 rounded-3xl grid place-items-center titulo text-3xl overflow-hidden flex-none bg-[var(--tarjeta-2,var(--borde))]" aria-hidden>
        {vista || tieneFoto
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={vista ?? `/app/foto?socio=${socioId}`} alt="" className="size-full object-cover" />
          : iniciales}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold">Mi foto</p>
        <p className="texto-suave text-sm">La recepción te reconoce más rápido. La va a revisar antes de dejarla fija.</p>
        <input ref={entrada} type="file" accept="image/*" capture="user" className="sr-only" aria-label="Elegir o sacar una foto" onChange={(e) => { void elegir(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="boton !min-h-11" disabled={subiendo} onClick={() => entrada.current?.click()} data-subir-foto>
          {subiendo ? "Subiendo…" : tieneFoto || vista ? "📷 Cambiar mi foto" : "📷 Subir mi foto"}
        </button>
        {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
      </div>
    </div>
  );
}
