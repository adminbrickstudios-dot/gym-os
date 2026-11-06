import type { Metadata } from "next";
import { VolverAlOrigen } from "@/components/panel/VolverAlOrigen";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Lista, type FaltaClase } from "./Lista";
import { Wod } from "./Wod";
import { Avisar } from "./Avisar";
import { ReemplazarProfe, type Reemplazo } from "./ReemplazarProfe";
import { Lugares } from "./Lugares";
import type { MapaLugares, OcupadoEquipo } from "@/lib/clases/lugares";

export const metadata: Metadata = { title: "Clase" };
type Fila = { socio_id: string; nombre: string; estado: string; posicion: number | null; presente: boolean; telefono?: string | null };
type Clase = { clase_id: string; actividad: string; emoji: string | null; inicio: string; fin: string; profe: string | null; cupo: number | null; confirmadas: number; cancelada: boolean; cancelada_motivo: string | null; wod: string | null; wod_por: string | null };

export default async function DetalleClase({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "clases");
    const [filas, clase, avisos, lugares] = await Promise.all([
      rpc<Fila[]>("lista_clase", { p_clase_id: id }),
      rpc<Clase>("clase_detalle", { p_clase_id: id }),
      rpc<{ texto: string; por: string; creado_en: string; personas: number }[]>("avisos_clase", { p_clase_id: id }),
      // COM-12: la sala numerada (null si no lo está).
      rpc<MapaLugares<OcupadoEquipo> | null>("lugares_clase", { p_clase_id: id }),
    ]);
    const zona = panel.gimnasio.zona_horaria;
    // VD-46K: solo dueño y encargado cambian al profe de esta clase (la base lo exige igual).
    const gestiona = panel.yo.rol === "dueno" || panel.yo.rol === "encargado";
    const [equipo, reemplazos] = gestiona
      ? await Promise.all([
        rpc<{ equipo_id: string; nombre: string; rol: string; activo: boolean }[]>("equipo_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
        rpc<Reemplazo[]>("reemplazos_clase", { p_clase_id: id }),
      ])
      : [[], [] as Reemplazo[]];
    // VD-46Q: quién faltó (clase ya terminada) y a quién se le perdonó; solo para dueño y encargado.
    const terminada = new Date(clase.fin).getTime() <= new Date().getTime();
    const faltas = gestiona && terminada && !clase.cancelada && panel.modo_clases === "reserva"
      ? await rpc<FaltaClase[]>("faltas_clase", { p_clase_id: id }) : [];
    const profes = equipo.filter((p) => p.rol === "profe" && p.activo).map((p) => ({ id: p.equipo_id, nombre: p.nombre }));
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <VolverAlOrigen href="/panel/clases" texto="Clases" className="texto-suave hover:text-[var(--texto)]" />
        <header className="mt-4 mb-8">
          <p className="text-4xl" aria-hidden>{clase.emoji ?? "🗓️"}</p>
          <h1 className="titular text-5xl sm:text-6xl mt-3">{clase.actividad ?? "Clase"}</h1>
          <p className="texto-suave text-lg mt-2 first-letter:uppercase">{hora(clase.inicio)}{clase.profe ? ` · ${clase.profe}` : ""}{clase.cupo != null ? ` · ${clase.confirmadas} de ${clase.cupo} lugares` : ""}</p>
          {clase.cancelada && <p className="pildora pildora-rojo mt-4">🚫 Cancelada: {clase.cancelada_motivo}</p>}
        </header>
        {!clase.cancelada && <ReemplazarProfe claseId={id} profeActual={clase.profe} profes={profes} historial={reemplazos} zona={zona}
          puedeReemplazar={gestiona && new Date(clase.fin).getTime() > new Date().getTime()} />}
        {!clase.cancelada && <Wod claseId={id} inicial={clase.wod} por={clase.wod_por} puedeEditar={panel.yo.rol !== "recepcion"} />}
        <Lista claseId={id} filas={filas} reserva={panel.modo_clases === "reserva"} cancelada={clase.cancelada}
          puedeCancelar buscaSocios={panel.yo.rol !== "profe"} faltas={faltas} />
        {!clase.cancelada && panel.modo_clases === "reserva" && <Lugares claseId={id} mapa={lugares} puedeNumerar={["dueno", "encargado"].includes(panel.yo.rol)} />}
        <Avisar claseId={id} anotados={filas.length} previos={avisos} zona={zona} />
      </>
    );
  });
}
