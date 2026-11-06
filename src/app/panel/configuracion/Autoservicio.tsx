"use client";
// VD-35 / VD-39 · Lo que los socios hacen solos. Dos interruptores que guardan al tocarlos (la base valida).
import Link from "next/link";
import { useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarComprasApp, guardarRegistroAbierto, type AutoservicioPanel } from "./autoservicio-acciones";

export function Autoservicio({ inicial, puedeEditar }: { inicial: AutoservicioPanel; puedeEditar: boolean }) {
  const [p, setP] = useState(inicial);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [guardando, empezar] = useTransition();
  const cambiar = (cual: "registro" | "compras", valor: boolean) => empezar(async () => {
    setMsj({});
    const r = cual === "registro" ? await guardarRegistroAbierto(valor) : await guardarComprasApp(valor);
    if (r.error || !r.panel) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
    setP(r.panel);
    setMsj({ ok: cual === "registro"
      ? (r.panel.abierto ? "Registro abierto: la gente se puede anotar sola desde tu página." : "Registro cerrado: la página ya no ofrece anotarse.")
      : (r.panel.compras_app ? "Los socios ya pueden cambiar de plan y comprar pases desde la app." : "Los socios ya no compran desde la app: lo hacen en recepción.") });
  });
  return (
    <div className="space-y-2" data-autoservicio>
      <Interruptor etiqueta="Registro abierto" disabled={!puedeEditar || guardando} checked={p.abierto} data-registro-abierto
        ayuda={p.tiene_reglamento
          ? "La gente se anota sola desde tu página, queda como socio sin pagar con el plan que eligió y entra cuando paga. Los menores de 18 se anotan en el gimnasio."
          : <>Primero escribí el reglamento en <Link href="/panel/pagina" className="underline">Tu página</Link>: cada socio nuevo lo tiene que aceptar.</>}
        onChange={(e) => cambiar("registro", e.target.checked)} />
      <Interruptor etiqueta="Cambiar de plan y comprar pases desde la app" disabled={!puedeEditar || guardando} checked={p.compras_app} data-compras-app
        ayuda="El socio elige otro plan o un pase, ve lo que le queda a favor y paga con MercadoPago o por transferencia. El plan cambia cuando se acredita el pago (la transferencia la aprobás vos o la recepción)."
        onChange={(e) => cambiar("compras", e.target.checked)} />
      {p.anotados_web > 0 && <p className="text-sm texto-tenue">🌐 {p.anotados_web} {p.anotados_web === 1 ? "socio se anotó" : "socios se anotaron"} solos por la web. <Link href="/panel/socios?web=1" className="underline">Verlos</Link></p>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </div>
  );
}
