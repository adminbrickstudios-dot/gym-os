"use client";
// El QR para entrar (ENT-2). Lo firma la base y cambia cada 30 segundos:
// una captura vieja no sirve. Se renueva solo, un poco antes de vencer.
// Sin señal: reintenta cada pocos segundos; al volver a la app (pantalla bloqueada, otra pestaña) renueva en el momento;
// si ya venció y no se pudo renovar, no deja a la vista un QR que no sirve y avisa qué hacer.
import { useEffect, useRef, useState } from "react";
import { codigoQR } from "./acciones";
import { Icono } from "@/components/ui/Icono";

const REINTENTO_MS = 3000;
export const TEXTO_SIN_SENAL = "Sin señal: decí tu DNI en la recepción.";

export function MiQR({ gimnasioId, socioId, inicial }: { gimnasioId: string; socioId: string; inicial: { codigo: string; vence_en: string } }) {
  const [qr, setQr] = useState(inicial);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallos, setFallos] = useState(0);
  const [quedan, setQuedan] = useState(() => Math.max(0, Math.ceil((Date.parse(inicial.vence_en) - Date.now()) / 1000)));
  const renovando = useRef(false);

  // Pide un código nuevo. Si falla (sin señal, la base no contesta) lo anota y el efecto reintenta.
  useEffect(() => {
    let vivo = true;
    const renovar = async () => {
      if (renovando.current) return;
      renovando.current = true;
      try {
        const r = await codigoQR(gimnasioId, socioId);
        if (!vivo) return;
        if (r.error || !r.codigo) throw new Error(r.error ?? "No se pudo renovar el QR");
        setError(null); setQr({ codigo: r.codigo, vence_en: r.vence_en! });
      } catch (e) {
        if (!vivo) return;
        setError(e instanceof Error && e.message ? e.message : "No se pudo renovar el QR");
        setFallos((n) => n + 1);
      } finally { renovando.current = false; }
    };
    const vence = Date.parse(qr.vence_en);
    // Se renueva un poco antes de vencer; si ya falló una vez, cada REINTENTO_MS.
    const t = setTimeout(renovar, error ? REINTENTO_MS : Math.max(0, vence - Date.now() - 1500));
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (vence - Date.now() < 3000) { clearTimeout(t); void renovar(); }
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      vivo = false; clearTimeout(t);
      document.removeEventListener("visibilitychange", alVolver); window.removeEventListener("online", alVolver); window.removeEventListener("focus", alVolver);
    };
  }, [qr, error, fallos, gimnasioId, socioId]);

  useEffect(() => {
    let vivo = true;
    // F0.5: la librería del QR se baja aparte (no pesa en el primer JS del Inicio).
    import("qrcode").then(({ default: QRCode }) => QRCode.toString(qr.codigo, { type: "svg", margin: 1, errorCorrectionLevel: "M" })).then((s) => { if (vivo) setSvg(s); });
    const vence = Date.parse(qr.vence_en);
    const tic = setInterval(() => setQuedan(Math.max(0, Math.ceil((vence - Date.now()) / 1000))), 500);
    setQuedan(Math.max(0, Math.ceil((vence - Date.now()) / 1000)));
    return () => { vivo = false; clearInterval(tic); };
  }, [qr]);

  const vencido = quedan <= 0;
  return (
    <section className="tarjeta p-6 text-center space-y-3" data-mi-qr data-codigo={qr.codigo} data-vencido={vencido ? "si" : "no"} aria-label="Tu QR para entrar">
      <p className="titulo text-2xl"><Icono nombre="celular" /> Tu QR para entrar</p>
      {/* Fondo blanco siempre: un lector no lee un QR sobre fondo oscuro. */}
      <div className="mx-auto w-64 max-w-full aspect-square rounded-[var(--radio)] bg-white p-3" aria-hidden
        style={vencido ? { opacity: 0.08 } : undefined}
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
      {vencido
        ? <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error ? TEXTO_SIN_SENAL : "Renovando tu QR…"}</p>
        : <p className="texto-suave">Mostralo en la recepción · se renueva en {quedan} s</p>}
      {error && !vencido && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
