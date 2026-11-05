import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { FilaAviso, type Aviso } from "./Aviso";
import { TandaAvisos } from "./Tanda";

export const metadata: Metadata = { title: "Avisos de hoy" };

const GRUPO: Record<string, string> = {
  clase_cancelada: "❌ Clase cancelada", por_vencer: "⏰ Vence pronto", vencido: "⛔ Venció hace poco", comprobante_rechazado: "🧾 Comprobante rechazado", cumpleanos: "🎂 Cumple años", no_viene: "👀 No viene",
};

/** AVI-1: la bandeja del día. Se calcula al abrirla (sin cron); los mensajes salen de Configuración → Mensajes. */
export default async function Avisos() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const avisos = await rpc<Aviso[]>("bandeja_avisos", { p_gimnasio_id: panel.gimnasio.id });
    const zona = panel.gimnasio.zona_horaria;
    const hora = (m: string | null) => (m ? new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m)) : null);
    const faltan = avisos.filter((a) => !a.avisado_en).length;
    const grupos = Object.keys(GRUPO).map((k) => [k, avisos.filter((a) => a.clave === k)] as const).filter(([, l]) => l.length);
    return (
      <>
        <Encabezado emoji="📬" titulo="Avisos de hoy"
          bajada={faltan ? `${faltan === 1 ? "Falta avisarle a 1 persona" : `Falta avisarles a ${faltan} personas`}. El mensaje ya está escrito: tocá WhatsApp y queda anotado.` : "A quién escribirle hoy, con el mensaje ya escrito."} />
        {avisos.length === 0 ? <Vacio emoji="✨" titulo="Hoy no hay a quién avisar">Cuando a alguien se le termine la cuota, deje de venir o cumpla años, aparece acá con el mensaje listo.</Vacio> : (
          <div className="space-y-10">
            {grupos.map(([k, lista]) => (
              <section key={k} data-grupo-avisos={k}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h2 className="titulo text-2xl flex-1">{GRUPO[k]} <span className="texto-tenue text-lg">{lista.length}</span></h2>
                  <TandaAvisos avisos={lista} etiqueta="Avisar a los que faltan" />
                </div>
                <ul className="space-y-2">{lista.map((a) => <FilaAviso key={`${a.clave}-${a.socio_id}-${a.referencia}`} a={a} hora={hora(a.avisado_en)} />)}</ul>
              </section>
            ))}
          </div>
        )}
      </>
    );
  });
}
