"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { borrarDemosVencidas, crearDemoProspecto } from "./acciones";

export type DemoVencida = { gimnasio_id: string; nombre: string; vencio: string };
/** Cierre para vender (25/11): las demos para prospectos (admin_demos_prospectos). El vencimiento lo calcula la base al pedir la lista. */
export type DemoProspecto = { gimnasio_id: string; nombre: string; slug: string; para: string; creado_en: string; vence: string; vencida: boolean; dias: number; host: string | null };
const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/**
 * "Demo para un prospecto" (Cierre para vender, 25/11): un gimnasio [demo] con el nombre del gimnasio del prospecto, su color y su logo
 * (opcional), con los datos de ejemplo y su dirección propia; vence a los 14 días. Abajo, la lista de prospectos y "Borrar demos vencidas".
 */
export function Demos({ vencidas, prospectos = [] }: { vencidas: DemoVencida[]; prospectos?: DemoProspecto[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [acento, setAcento] = useState("#16a34a");
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string; web?: string }>({});
  return (
    <section className="space-y-3" id="demos" data-demos>
      <p className="titulo-grupo">Demo para un prospecto</p>
      <form className="tarjeta p-4 grid gap-3 sm:grid-cols-3 items-end" data-demo-prospecto
        onSubmit={(e) => e.preventDefault()}>
        <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Nombre del gimnasio del prospecto</span>
          <input className="campo" name="nombre" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Olimpo Gym" /></label>
        <label className="space-y-1"><span className="etiqueta">Color de su marca</span>
          <span className="flex items-center gap-2"><input type="color" name="acento" value={acento} onChange={(e) => setAcento(e.target.value)} className="h-12 w-16 rounded-[var(--radio)] border border-[var(--borde)] bg-transparent" aria-label="Color de su marca" />
            <span className="texto-suave numero">{acento}</span></span></label>
        <label className="space-y-1 sm:col-span-3"><span className="etiqueta">Su logo (opcional)</span>
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="campo" aria-label="Su logo (opcional)" data-demo-logo /></label>
        <div className="sm:col-span-3 flex flex-wrap gap-2 items-center">
          <BotonAccion className="boton boton-principal" ocupadoTexto="Creando la demo…" disabled={nombre.trim().length < 2} data-crear-demo onClick={async (e) => {
            const form = (e?.currentTarget as HTMLElement | undefined)?.closest("form") ?? document.querySelector<HTMLFormElement>("[data-demo-prospecto]");
            const datos = new FormData(form ?? undefined);
            datos.set("nombre", nombre); datos.set("acento", acento);
            const r = await crearDemoProspecto(datos);
            if (r.error) { setMsj({ texto: r.error }); return; }
            setMsj({ ok: true, texto: r.aviso, web: r.web }); setNombre(""); form?.reset(); router.refresh();
          }}>Crear la demo</BotonAccion>
          <span className="texto-suave text-sm">Con socios de ejemplo (ficticios), en Pista Semáforo, aparte de los gimnasios reales. A los 14 días queda vencida.</span>
        </div>
        {msj.texto && <p role={msj.ok ? "status" : "alert"} className={`sm:col-span-3 ${msj.ok ? "texto-suave" : "pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3"}`} data-demo-resultado>
          {msj.texto}{msj.web && <> <a href={msj.web} target="_blank" rel="noopener noreferrer" className="underline">Abrir la demo</a></>}</p>}
      </form>
      {prospectos.length > 0 && (
        <div className="tarjeta p-4 space-y-2" data-demos-prospectos={prospectos.length}>
          <p className="font-semibold">Prospectos con demo</p>
          <ul className="space-y-1">
            {prospectos.map((d) => (
              <li key={d.gimnasio_id} className="flex flex-wrap items-center gap-2" data-demo-prospecto-fila={d.vencida ? "vencida" : "activa"}>
                <span className="font-semibold">{d.nombre}</span>
                <span className={`pildora ${d.vencida ? "pildora-rojo" : d.dias <= 3 ? "pildora-amarillo" : ""}`}>{d.vencida ? `Venció el ${dia(d.vence)}` : `Vence en ${d.dias} ${d.dias === 1 ? "día" : "días"} (${dia(d.vence)})`}</span>
                {d.host && <a href={`https://${d.host}`} target="_blank" rel="noopener noreferrer" className="texto-suave underline">{d.host}</a>}
                <a href={`/admin/${d.gimnasio_id}`} className="texto-suave underline">Ficha</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {vencidas.length > 0 && (
        <div className="tarjeta p-4 space-y-2" data-demos-vencidas>
          <p className="font-semibold">{vencidas.length === 1 ? "1 demo vencida" : `${vencidas.length} demos vencidas`}</p>
          <p className="texto-suave text-sm">{vencidas.map((d) => d.nombre).join(" · ")}</p>
          <BotonAccion className="boton" onClick={async () => { const r = await borrarDemosVencidas(); if (r.error) setMsj({ texto: r.error }); else router.refresh(); }}>Borrar demos vencidas</BotonAccion>
        </div>
      )}
    </section>
  );
}
