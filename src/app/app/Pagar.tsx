"use client";
import { useRef, useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { informarPago } from "./acciones";

/** Datos para transferir y subir el comprobante. El pago queda pendiente hasta que el gimnasio lo aprueba. */
export function Pagar({ gimnasioId, socioId, monto, datos }: { gimnasioId: string; socioId: string; monto: number | null; datos: { alias: string | null; cbu: string | null; titular: string | null } }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [estado, setEstado] = useState<{ ok?: boolean; texto?: string }>({});
  const [subiendo, empezar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const copiar = async (t: string) => { await navigator.clipboard.writeText(t); setCopiado(t); setTimeout(() => setCopiado(null), 1500); };

  const subir = (f: File) => empezar(async () => {
    if (f.size > 5 * 1024 * 1024) { setEstado({ texto: "El archivo pesa más de 5 MB" }); return; }
    const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${gimnasioId}/${socioId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await crearClienteNavegador().storage.from("comprobantes").upload(path, f, { contentType: f.type });
    if (error) { setEstado({ texto: `No se pudo subir: ${error.message}` }); return; }
    const r = await informarPago(socioId, path);
    setEstado(r.error ? { texto: r.error } : { ok: true, texto: "Listo: el gimnasio lo revisa y te habilita." });
  });

  return (
    <section className="tarjeta p-5 space-y-4">
      <p className="titulo text-2xl">🏦 Pagar por transferencia</p>
      {monto != null && <p><span className="numero text-4xl">{formatearPesos(monto)}</span> <span className="texto-suave">por transferencia</span></p>}
      {[["Alias", datos.alias], ["CBU / CVU", datos.cbu]].filter(([, v]) => v).map(([k, v]) => (
        <button key={k} type="button" onClick={() => copiar(v!)} className="boton w-full !justify-between">
          <span className="text-left"><span className="block text-xs texto-tenue">{k}</span><span className="block font-semibold break-all">{v}</span></span>
          <span className="text-sm texto-suave">{copiado === v ? "✅ Copiado" : "📋 Copiar"}</span>
        </button>
      ))}
      {datos.titular && <p className="texto-suave text-sm">A nombre de {datos.titular}</p>}
      <input ref={archivo} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
      <button type="button" disabled={subiendo || estado.ok} onClick={() => archivo.current?.click()} className="boton boton-principal w-full text-lg">
        {subiendo ? "Subiendo…" : "📸 Ya transferí: subir comprobante"}
      </button>
      {estado.texto && <p role="status" className={`pildora ${estado.ok ? "pildora-verde" : "pildora-rojo"} !rounded-2xl !px-4 !py-3 w-full`}>{estado.texto}</p>}
    </section>
  );
}
