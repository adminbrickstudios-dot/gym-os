import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { Ajustes, type Config, type DatosGimnasio } from "./Ajustes";
import type { CierrePanel } from "./Horarios";
import type { MensajePanel } from "./Mensajes";
import type { Cambio } from "./Historial";
import type { Agenda } from "@/lib/horarios";
import { PESTANAS, type ClavePestana } from "./pestanas";
import type { EstadoMP, Tablet } from "./acciones";
import type { ConfigEntrada } from "@/app/panel/entrada/config";
import type { ConfigDejarPasar, ReglasVencimiento } from "./cobros-acciones";
import type { ConfigCaja } from "@/app/panel/caja/tipos";
import type { AutoservicioPanel } from "./autoservicio-acciones";

export const metadata: Metadata = { title: "Configuración" };

export default async function Configuracion({ searchParams }: { searchParams: Promise<{ pestana?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [config, datos, agenda, cierres, mensajes, cambios, tablets, mercadopago, turnosFijos, encuestas, entrada, metaVisitas, vencimiento, dejarPasar, cajaConfig, autoservicio, planFamiliar, { pestana }] = await Promise.all([
      rpc<Config>("configuracion_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<DatosGimnasio>("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Agenda>("horarios_apertura_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<CierrePanel[]>("cierres_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<MensajePanel[]>("mensajes_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Cambio[]>("historial_configuracion", { p_gimnasio_id: panel.gimnasio.id, p_limite: 100 }),
      rpc<Tablet[]>("tablets_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<EstadoMP>("estado_pagos_online", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<boolean>("config_turnos_fijos", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<{ link_resena: string | null }>("encuestas_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<ConfigEntrada>("config_entrada", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<number>("meta_visitas_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<ReglasVencimiento>("reglas_vencimiento", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<ConfigDejarPasar>("config_dejar_pasar", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<ConfigCaja>("config_caja", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<AutoservicioPanel>("autoservicio_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<boolean>("plan_familiar_estado", { p_gimnasio_id: panel.gimnasio.id }),
      searchParams,
    ]);
    const inicial: ClavePestana = PESTANAS.find((p) => p.clave === pestana)?.clave ?? "gimnasio";
    return (
      <>
        <Encabezado emoji="⚙️" titulo="Configuración" bajada="Los datos de tu gimnasio, tu marca, cómo cobrás y qué secciones usás." />
        <Ajustes inicial={config} datos={datos} agenda={agenda} cierres={cierres} mensajes={mensajes} cambios={cambios} puedeEditar={panel.yo.rol === "dueno"} pestanaInicial={inicial}
          direccionPagina={await direccionPagina(datos.slug)} tablets={tablets} mercadopago={mercadopago} turnosFijos={turnosFijos}
          linkResena={encuestas.link_resena} entrada={entrada} metaVisitas={metaVisitas} planFamiliar={planFamiliar} vencimiento={vencimiento} dejarPasar={dejarPasar} cajaConfig={cajaConfig} autoservicio={autoservicio} />
      </>
    );
  });
}
