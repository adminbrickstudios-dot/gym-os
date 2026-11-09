"use client";
// Foto del socio: con la cámara (compu o celular) o eligiendo una imagen. Se
// recorta cuadrada y se achica a 480 px en el navegador, y la sube el servidor.
import { useEffect, useRef, useState, useTransition } from "react";
import { confirmarFotoSubida, guardarFoto, quitarFoto } from "../acciones";

const LADO = 480;

/** Recorta al centro, cuadrado, y devuelve un JPG de LADO×LADO. */
function aJpg(fuente: CanvasImageSource, ancho: number, alto: number): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = LADO; c.height = LADO;
  const lado = Math.min(ancho, alto);
  c.getContext("2d")!.drawImage(fuente, (ancho - lado) / 2, (alto - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo armar la foto"))), "image/jpeg", 0.85));
}

export function Foto({ socioId, iniciales, version, color, subidaPorSocio = false, puedeConfirmar = false }: { socioId: string; iniciales: string; version: string | null; color: string; subidaPorSocio?: boolean; puedeConfirmar?: boolean }) {
  const [confirmada, setConfirmada] = useState(false);
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null);
  const [confirmando, confirmar] = useTransition();
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, empezar] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);
  const [camara, setCamara] = useState<"pidiendo" | "lista" | "sin" | null>(null);

  const cerrar = () => { flujo.current?.getTracks().forEach((t) => t.stop()); flujo.current = null; setAbierta(false); setCamara(null); };
  useEffect(() => () => flujo.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => {
    if (!abierta) return;
    setCamara("pidiendo");
    if (!navigator.mediaDevices?.getUserMedia) { setCamara("sin"); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false })
      .then((s) => { flujo.current = s; if (video.current) { video.current.srcObject = s; void video.current.play(); } setCamara("lista"); })
      .catch(() => setCamara("sin"));
  }, [abierta]);

  const subir = (b: Blob) => empezar(async () => {
    const f = new FormData(); f.set("foto", new File([b], "foto.jpg", { type: "image/jpeg" }));
    const r = await guardarFoto(socioId, f);
    if (r.error) { setError(r.error); return; }
    setError(null); cerrar();
  });
  const sacar = async () => {
    const v = video.current; if (!v) return;
    try { subir(await aJpg(v, v.videoWidth, v.videoHeight)); } catch (e) { setError((e as Error).message); }
  };
  const elegir = async (archivo: File) => {
    try {
      const img = await createImageBitmap(archivo);
      subir(await aJpg(img, img.width, img.height));
    } catch { setError("No se pudo leer esa imagen. Probá con otra (JPG o PNG)."); }
  };

  return (
    <div className="flex-none" data-foto={version ? "si" : "no"}>
      <button type="button" onClick={() => setAbierta(true)} aria-label={version ? "Cambiar la foto" : "Sacar una foto"}
        className="size-16 sm:size-20 rounded-3xl grid place-items-center titulo text-3xl overflow-hidden relative group"
        style={{ background: `color-mix(in oklab, ${color}, var(--fondo) 75%)` }}>
        {version
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/panel/socios/${socioId}/foto?v=${version}`} alt="" className="w-full h-full object-cover" />
          : iniciales}
        <span className="absolute bottom-0 inset-x-0 text-xs bg-black/50 text-white py-0.5 opacity-80" aria-hidden>📷</span>
      </button>
      {subidaPorSocio && !confirmada && version && (
        <div className="mt-2 max-w-40 space-y-1" data-foto-sin-confirmar>
          <p className="pildora pildora-amarillo whitespace-normal text-xs">Foto nueva, subida por el socio</p>
          {puedeConfirmar && <button type="button" className="boton boton-chico" disabled={confirmando}
            onClick={() => confirmar(async () => { const r = await confirmarFotoSubida(socioId); if (r.error) setErrorConfirmar(r.error); else setConfirmada(true); })}>{confirmando ? "Confirmando…" : "Confirmar la foto"}</button>}
          {errorConfirmar && <p role="alert" className="text-xs">{errorConfirmar}</p>}
        </div>
      )}
      {abierta && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" role="dialog" aria-label="Foto del socio">
          <div className="tarjeta p-5 w-full max-w-md space-y-4">
            <p className="titulo text-2xl">📷 Foto del socio</p>
            <p className="text-sm texto-tenue">Para reconocerlo en la puerta. Se guarda privada: solo la ve el equipo.</p>
            {camara === "lista" || camara === "pidiendo"
              ? <video ref={video} playsInline muted className="w-full aspect-square object-cover rounded-xl bg-black" data-video />
              : <p className="texto-suave">No hay cámara disponible (o no diste permiso). Elegí una foto.</p>}
            {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
            <div className="flex flex-wrap gap-2">
              {camara === "lista" && <button type="button" className="boton boton-principal" disabled={subiendo} onClick={sacar}>{subiendo ? "Guardando…" : "📸 Sacar foto"}</button>}
              <label className={`boton cursor-pointer ${camara === "sin" ? "boton-principal" : ""}`}>
                🖼️ Elegir una imagen
                <input type="file" accept="image/*" capture="user" className="sr-only" aria-label="Elegir una imagen"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void elegir(f); e.target.value = ""; }} />
              </label>
              {version && <button type="button" className="boton texto-suave" disabled={subiendo}
                onClick={() => empezar(async () => { const r = await quitarFoto(socioId); if (r.error) setError(r.error); else cerrar(); })}>🗑️ Quitar la foto</button>}
              <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
