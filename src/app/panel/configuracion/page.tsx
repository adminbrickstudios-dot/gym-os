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

export const metadata: Metadata = { title: "Configuración" };

export default async function Configuracion({ searchParams }: { searchParams: Promise<{ pestana?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [config, datos, agenda, cierres, mensajes, cambios, tablets, mercadopago, { pestana }] = await Promise.all([
      rpc<Config>("configuracion_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<DatosGimnasio>("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Agenda>("horarios_apertura_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<CierrePanel[]>("cierres_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<MensajePanel[]>("mensajes_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Cambio[]>("historial_configuracion", { p_gimnasio_id: panel.gimnasio.id, p_limite: 100 }),
      rpc<Tablet[]>("tablets_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<EstadoMP>("estado_pagos_online", { p_gimnasio_id: panel.gimnasio.id }),
      searchParams,
    ]);
    const inicial: ClavePestana = PESTANAS.find((p) => p.clave === pestana)?.clave ?? "gimnasio";
    return (
      <>
        <Encabezado emoji="⚙️" titulo="Configuración" bajada="Los datos de tu gimnasio, tu marca, cómo cobrás y qué secciones usás." />
        <Ajustes inicial={config} datos={datos} agenda={agenda} cierres={cierres} mensajes={mensajes} cambios={cambios} puedeEditar={panel.yo.rol === "dueno"} pestanaInicial={inicial}
          direccionPagina={await direccionPagina(datos.slug)} tablets={tablets} mercadopago={mercadopago} />
      </>
    );
  });
}
