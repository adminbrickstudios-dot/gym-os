"use client";
// El QR para entrar (ENT-2). Lo firma la base y cambia cada 30 segundos:
// una captura vieja no sirve. Se renueva solo, un poco antes de vencer.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { codigoQR } from "./acciones";

export function MiQR({ gimnasioId, socioId, inicial }: { gimnasioId: string; socioId: string; inicial: { codigo: string; vence_en: string } }) {
  const [qr, setQr] = useState(inicial);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quedan, setQuedan] = useState(30);

  useEffect(() => {
    let vivo = true;
    QRCode.toString(qr.codigo, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => { if (vivo) setSvg(s); });
    const vence = Date.parse(qr.vence_en);
    const tic = setInterval(() => setQuedan(Math.max(0, Math.ceil((vence - Date.now()) / 1000))), 500);
    const renovar = setTimeout(async () => {
      const r = await codigoQR(gimnasioId, socioId);
      if (!vivo) return;
      if (r.error || !r.codigo) setError(r.error ?? "No se pudo renovar el QR");
      else { setError(null); setQr({ codigo: r.codigo, vence_en: r.vence_en! }); }
    }, Math.max(1000, vence - Date.now() - 1500));
    return () => { vivo = false; clearInterval(tic); clearTimeout(renovar); };
  }, [qr, gimnasioId, socioId]);

  return (
    <section className="tarjeta p-6 text-center space-y-3" data-mi-qr data-codigo={qr.codigo} aria-label="Tu QR para entrar">
      <p className="titulo text-2xl">📱 Tu QR para entrar</p>
      {/* Fondo blanco siempre: un lector no lee un QR sobre fondo oscuro. */}
      <div className="mx-auto w-64 max-w-full aspect-square rounded-2xl bg-white p-3" aria-hidden
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
      <p className="texto-suave">Mostralo en la recepción · se renueva en {quedan} s</p>
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
    </section>
  );
}
