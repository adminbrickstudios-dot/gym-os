"use client";
// Las tablets autorizadas para la puerta (ENT-3). Autorizar da un link que se
// abre una vez en la tablet (o se escanea su QR); revocar la apaga al instante.
import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { autorizarTablet, revocarTablet, type Tablet } from "./acciones";
import { fechaCorta } from "@/lib/formato";

export function Tablets({ inicial, sedes, esDueno, zona }: { inicial: Tablet[]; sedes: { id: string; nombre: string }[]; esDueno: boolean; zona: string }) {
  const [tablets, setTablets] = useState(inicial);
  const [nombre, setNombre] = useState("Puerta");
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  useEffect(() => { if (link) void QRCode.toString(link, { type: "svg", margin: 1 }).then(setQr); else setQr(null); }, [link]);
  const activas = tablets.filter((t) => !t.revocado);

  return (
    <div className="space-y-3 pl-1" data-tablets={activas.length}>
      {activas.length > 0 && (
        <ul className="divide-y divide-[var(--borde)]">
          {activas.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1"><span className="font-semibold">📲 {t.nombre}</span>
                <span className="block text-sm texto-tenue">{sedes.length > 1 ? `${t.sede} · ` : ""}{t.ultimo_uso ? `usada el ${fechaCorta(t.ultimo_uso, zona)}` : "todavía sin usar"}</span></span>
              {esDueno && <button type="button" className="boton" disabled={ocupado} onClick={() => empezar(async () => {
                const r = await revocarTablet(t.id); if (r.error) setError(r.error); else { setError(null); setTablets(r.tablets!); }
              })}>Revocar</button>}
            </li>
          ))}
        </ul>
      )}
      {esDueno && !link && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 flex-1 basis-40"><span className="block text-sm texto-suave">Nombre de la tablet</span>
            <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} aria-label="Nombre de la tablet" /></label>
          {sedes.length > 1 && (
            <label className="space-y-1"><span className="block text-sm texto-suave">Sede</span>
              <select className="campo" value={sede} onChange={(e) => setSede(e.target.value)} aria-label="Sede de la tablet">
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select></label>
          )}
          <button type="button" className="boton" disabled={ocupado || !nombre.trim()} onClick={() => empezar(async () => {
            const r = await autorizarTablet(sede, nombre);
            if (r.error) { setError(r.error); return; }
            setError(null); setTablets(r.tablets!); setLink(`${window.location.origin}/kiosco/activar?t=${r.token}`);
          })}>➕ Autorizar una tablet</button>
        </div>
      )}
      {link && (
        <div className="tarjeta p-4 space-y-3" data-link-tablet={link}>
          <p className="font-semibold">Abrí este link en la tablet (o escaneá el QR con ella). Se ve una sola vez.</p>
          {qr && <div className="w-44 aspect-square bg-white rounded-xl p-2" aria-hidden dangerouslySetInnerHTML={{ __html: qr }} />}
          <p className="text-sm break-all texto-suave">{link}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton" onClick={() => void navigator.clipboard?.writeText(link)}>📋 Copiar link</button>
            <button type="button" className="boton" onClick={() => setLink(null)}>Listo</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
    </div>
  );
}
