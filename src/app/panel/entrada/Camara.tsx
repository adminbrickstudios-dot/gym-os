"use client";
// Lector de QR con la cámara (ENT-2): busca un código en cada cuadro y,
// cuando lo encuentra, lo pasa una sola vez. La validación la hace la base.
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** `frente`: la cámara de adelante (la tablet mira al socio); si no, la de atrás (la recepción apunta al celular). */
export function Camara({ alLeer, alCerrar, frente = false }: { alLeer: (codigo: string) => void; alCerrar: () => void; frente?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<"pidiendo" | "leyendo" | "sin">("pidiendo");
  const leido = useRef(false);

  useEffect(() => {
    let flujo: MediaStream | null = null, cuadro = 0, vivo = true;
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    const mirar = () => {
      const v = video.current;
      if (!vivo || !v || !ctx) return;
      if (v.readyState >= 2 && v.videoWidth) {
        // Achicado: alcanza para un QR y es mucho más liviano.
        const escala = Math.min(1, 640 / v.videoWidth);
        lienzo.width = Math.round(v.videoWidth * escala); lienzo.height = Math.round(v.videoHeight * escala);
        ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
        const r = jsQR(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height, { inversionAttempts: "dontInvert" });
        if (r?.data && !leido.current) { leido.current = true; alLeer(r.data); return; }
      }
      cuadro = requestAnimationFrame(mirar);
    };
    if (!navigator.mediaDevices?.getUserMedia) { setEstado("sin"); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: frente ? "user" : "environment" }, audio: false })
      .then((s) => { flujo = s; if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        if (video.current) { video.current.srcObject = s; void video.current.play(); } setEstado("leyendo"); cuadro = requestAnimationFrame(mirar); })
      .catch(() => setEstado("sin"));
    return () => { vivo = false; cancelAnimationFrame(cuadro); flujo?.getTracks().forEach((t) => t.stop()); };
  }, [alLeer, frente]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [alCerrar]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" role="dialog" aria-label="Leer QR con la cámara" data-camara={estado}>
      <div className="tarjeta p-5 w-full max-w-md space-y-4">
        <p className="titulo text-2xl">📷 Leer QR</p>
        {estado === "sin"
          ? <p className="texto-suave">No hay cámara disponible (o no diste permiso). Buscalo por nombre o DNI.</p>
          : <video ref={video} playsInline muted className="w-full aspect-square object-cover rounded-xl bg-black" />}
        <p className="text-sm texto-tenue">{frente ? "Mostrá el QR de tu app frente a la cámara." : "Que el socio muestre el QR de su app frente a la cámara."}</p>
        <button type="button" className="boton w-full" onClick={alCerrar}>Cancelar</button>
      </div>
    </div>
  );
}
