import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import { Puerta } from "./Puerta";
import { SinInternet } from "./SinInternet";
import { Hoy, type Ingreso } from "./Hoy";
import type { ResultadoSocio } from "@/app/panel/acciones";
import type { Ficha } from "@/app/panel/socios/[id]/tipos";
import { Invitados } from "./Invitados";
import type { Invitado } from "./acciones";

export const metadata: Metadata = { title: "Entrada" };


export default async function Entrada({ searchParams }: { searchParams: Promise<{ sede?: string; socio?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "entrada");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const sp = await searchParams;
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const [hoy, formas, invitados] = await Promise.all([
      rpc<Ingreso[]>("ingresos_del_dia", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id }),
      rpc<string[]>("formas_de_entrada", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Invitado[]>("invitados_de_hoy", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    // ?socio= (al volver de cobrar): se abre su veredicto.
    const ficha = /^[0-9a-f-]{36}$/.test(sp.socio ?? "") ? await rpc<Ficha>("ficha_socio", { p_socio_id: sp.socio }).catch(() => null) : null;
    const vuelto: ResultadoSocio | null = ficha ? { socio_id: ficha.socio.id, numero: ficha.socio.numero, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim(),
      color: ficha.acceso.color, texto: ficha.acceso.texto, puede: ficha.acceso.puede, dado_de_baja: !!ficha.socio.dado_de_baja_en } : null;

    return (
      <>
        <Encabezado emoji="🚪" titulo="Entrada" bajada="Buscá al socio: te dice si puede entrar y, si no, por qué."
          accion={panel.yo.rol !== "recepcion" ? <Link href="/panel/entrada/control" className="boton">🔎 Control de la puerta</Link> : undefined} />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/entrada" />}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 [&>*]:min-w-0">
          <div className="flex flex-col gap-6">
            {/* SEG-5: la copia para cuando se corta internet (se prende por compu). */}
            <SinInternet sedeId={sede.id} zona={panel.gimnasio.zona_horaria} />
            <Puerta sedeId={sede.id} conQr={formas.includes("qr_socio")} conLlavero={formas.includes("nfc")} esRecepcion={panel.yo.rol === "recepcion"} socioInicial={vuelto} />
          </div>
          <div>
            <Hoy ingresos={hoy} zona={panel.gimnasio.zona_horaria} />
            <Invitados sedeId={sede.id} inicial={invitados} zona={panel.gimnasio.zona_horaria} />
          </div>
        </div>
      </>
    );
  });
}
