"use client";
// Hacerse socio desde la página: prender o apagar, y el reglamento que cada
// socio nuevo acepta (cada cambio es una versión nueva; lo aceptado no cambia).
import Link from "next/link";
import { useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarAltas } from "./acciones";

export type AltasPanel = {
  altas_online: boolean; reglamento: { version: number; texto: string; creado_en: string } | null;
  transferencia: { alias: string | null; cbu: string | null } | null; aceptaciones: number;
};

export function Altas({ inicial, puedeEditar }: { inicial: AltasPanel; puedeEditar: boolean }) {
  const [guardado, setGuardado] = useState(inicial);
  const [prendidas, setPrendidas] = useState(inicial.altas_online);
  const [texto, setTexto] = useState(inicial.reglamento?.texto ?? "");
  const [msj, setMsj] = useState<{ ok?: string; error?: string; n: number }>({ n: 0 });
  const [guardando, empezar] = useTransition();
  const sucio = prendidas !== guardado.altas_online || texto.trim() !== (guardado.reglamento?.texto ?? "");
  const guardar = () => empezar(async () => {
    const r = await guardarAltas(prendidas, texto);
    if (r.error || !r.altas) { setMsj((m) => ({ error: r.error ?? "No se pudo guardar", n: m.n + 1 })); return; }
    const a = r.altas as AltasPanel;
    setGuardado(a); setPrendidas(a.altas_online); setTexto(a.reglamento?.texto ?? "");
    setMsj((m) => ({ ok: a.altas_online ? "Guardado: la gente ya se puede anotar desde tu página." : "Guardado.", n: m.n + 1 }));
  });
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-altas data-respuestas={msj.n}>
      <div><p className="titulo text-2xl">💪 Hacerse socio desde la página</p>
        <p className="texto-suave">Con esto prendido, la página muestra “Hacete socio” y en cada plan “Elegir este”: la persona deja sus datos, acepta el reglamento y elige pagar por transferencia o en el gimnasio. Queda como socio sin pagar hasta que cobrás.</p></div>
      <fieldset disabled={!puedeEditar} className="space-y-4">
        <Interruptor etiqueta="Aceptar altas online" ayuda={guardado.reglamento ? `Se anotaron ${guardado.aceptaciones} aceptando el reglamento.` : "Primero escribí el reglamento."}
          checked={prendidas} onChange={(e) => setPrendidas(e.target.checked)} />
        <label className="block space-y-1">
          <span className="etiqueta">Reglamento {guardado.reglamento && <span className="texto-tenue font-normal">· versión {guardado.reglamento.version}</span>}</span>
          <textarea className="campo min-h-40" maxLength={8000} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={"1. Traé toalla.\n2. Dejá los discos y mancuernas en su lugar.\n3. La cuota se paga del 1 al 10 de cada mes."} />
          <span className="block text-sm texto-tenue">Si lo cambiás, se guarda como versión nueva: los que ya se anotaron aceptaron la anterior.</span>
        </label>
        {!guardado.transferencia && <p className="text-sm texto-tenue">Sin alias ni CBU cargados (o con Transferencias apagada), se paga solo en el gimnasio. <Link href="/panel/configuracion?pestana=cobros" className="underline">Cargarlos en Configuración → Cobros</Link>.</p>}
      </fieldset>
      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="boton boton-principal" disabled={!sucio || guardando} onClick={guardar}>{guardando ? "Guardando…" : "💾 Guardar"}</button>
          {sucio && <span className="text-sm texto-suave">• Cambios sin guardar</span>}
        </div>
      )}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !sucio && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </section>
  );
}
