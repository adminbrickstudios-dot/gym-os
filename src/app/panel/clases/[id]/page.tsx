import type { Metadata } from "next";
import Link from "next/link";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Lista } from "./Lista";

export const metadata: Metadata = { title: "Clase" };
type Fila = { socio_id: string; nombre: string; estado: string; posicion: number | null; presente: boolean };
type Clase = { clase_id: string; actividad: string; emoji: string | null; inicio: string; fin: string; profe: string | null; cupo: number | null; confirmadas: number; cancelada: boolean; cancelada_motivo: string | null };

export default async function DetalleClase({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "clases");
    const [filas, clase] = await Promise.all([
      rpc<Fila[]>("lista_clase", { p_clase_id: id }),
      rpc<Clase>("clase_detalle", { p_clase_id: id }),
    ]);
    const zona = panel.gimnasio.zona_horaria;
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <Link href="/panel/clases" className="texto-suave hover:text-[var(--texto)]">← Clases</Link>
        <header className="mt-4 mb-8">
          <p className="text-4xl" aria-hidden>{clase.emoji ?? "🗓️"}</p>
          <h1 className="titular text-5xl sm:text-6xl mt-3">{clase.actividad ?? "Clase"}</h1>
          <p className="texto-suave text-lg mt-2 first-letter:uppercase">{hora(clase.inicio)}{clase.profe ? ` · ${clase.profe}` : ""}{clase.cupo != null ? ` · ${clase.confirmadas} de ${clase.cupo} lugares` : ""}</p>
          {clase.cancelada && <p className="pildora pildora-rojo mt-4">🚫 Cancelada: {clase.cancelada_motivo}</p>}
        </header>
        <Lista claseId={id} filas={filas} reserva={panel.modo_clases === "reserva"} cancelada={clase.cancelada}
          puedeCancelar buscaSocios={panel.yo.rol !== "profe"} />
      </>
    );
  });
}
