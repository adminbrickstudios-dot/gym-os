"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { guardarPlantillaTexto, restaurarPlantillaTexto, type TextoPlantilla } from "../acciones";

const NOMBRE_TIPO: Record<string, string> = { musculacion: "Musculación", grande: "Gimnasio grande", box: "Box", yoga: "Yoga y pilates", artes: "Artes marciales", natacion: "Natación", personal: "Entrenador personal", "24h": "24 horas" };

function Editor({ texto, tipo, valor }: { texto: TextoPlantilla; tipo: string | null; valor: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(valor ?? "");
  const [msj, setMsj] = useState<{ ok?: boolean; t?: string }>({});
  const dato = (n: number | undefined) => `Se actualizaron ${n ?? 0} ${n === 1 ? "gimnasio" : "gimnasios"} que no habían editado este texto.`;
  return (
    <div className="space-y-1" data-plantilla={`${texto.clave}:${tipo ?? "plataforma"}`}>
      <div className="flex flex-wrap gap-2 items-end">
        <input className="campo flex-1 min-w-[16rem]" value={v} maxLength={texto.max} placeholder={tipo ? "Sin plantilla propia: usa la de la plataforma" : texto.fabrica}
          onChange={(e) => setV(e.target.value)} aria-label={`${texto.etiqueta}${tipo ? ` (${NOMBRE_TIPO[tipo] ?? tipo})` : ""}`} />
        <BotonAccion className="boton" disabled={!v.trim() || v.trim() === (valor ?? "")} data-guardar-plantilla onClick={async () => {
          const r = await guardarPlantillaTexto(texto.clave, tipo, v);
          if (r.error) setMsj({ t: r.error }); else { setMsj({ ok: true, t: dato(r.gimnasios) }); router.refresh(); }
        }}>Guardar</BotonAccion>
        {valor !== null && (
          <BotonAccion className="boton texto-suave" data-restaurar-plantilla onClick={async () => {
            const r = await restaurarPlantillaTexto(texto.clave, tipo);
            if (r.error) setMsj({ t: r.error }); else { setV(""); setMsj({ ok: true, t: `Restaurada por defecto. ${dato(r.gimnasios)}` }); router.refresh(); }
          }}>Restaurar por defecto</BotonAccion>
        )}
      </div>
      {msj.t && <p role={msj.ok ? "status" : "alert"} className={msj.ok ? "texto-suave text-sm" : "pildora pildora-rojo !rounded-2xl !px-4 !py-3"}>{msj.t}</p>}
    </div>
  );
}

export function Plantillas({ tipos, textos }: { tipos: string[]; textos: TextoPlantilla[] }) {
  return (
    <div className="space-y-6" data-plantillas>
      {textos.map((t) => (
        <section key={t.clave} className="tarjeta p-5 space-y-3" data-texto-plantilla={t.clave}>
          <div>
            <p className="font-semibold">{t.etiqueta} <span className="pildora align-middle">{t.grupo}</span></p>
            <p className="texto-tenue text-sm">De fábrica: {t.fabrica}</p>
          </div>
          <div className="space-y-1"><p className="etiqueta">Plantilla de la plataforma (todos los tipos)</p><Editor key={`${t.clave}-p`} texto={t} tipo={null} valor={t.plataforma} /></div>
          <details className="space-y-3">
            <summary className="cursor-pointer texto-suave">Por tipo de gimnasio ({Object.keys(t.por_tipo).length} con plantilla propia)</summary>
            <div className="space-y-3 pt-2">
              {tipos.map((tipo) => (
                <div key={tipo} className="space-y-1"><p className="etiqueta">{NOMBRE_TIPO[tipo] ?? tipo} <span className="texto-tenue normal-case">({t.gimnasios_por_tipo[tipo] ?? 0} gimnasios)</span></p>
                  <Editor key={`${t.clave}-${tipo}`} texto={t} tipo={tipo} valor={t.por_tipo[tipo] ?? null} /></div>
              ))}
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
