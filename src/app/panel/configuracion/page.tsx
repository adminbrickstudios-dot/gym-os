import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, fijo, lectura, rpcLote } from "@/lib/panel/servidor";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { Ajustes, type Config, type DatosGimnasio } from "./Ajustes";
import type { CierrePanel } from "./Horarios";
import type { MensajePanel } from "./Mensajes";
import type { Cambio } from "./Historial";
import type { Agenda } from "@/lib/horarios";
import { PESTANAS, type ClavePestana } from "./pestanas";
import type { EstadoMP, Tablet } from "./acciones";
import type { ConfigEntrada } from "@/app/panel/entrada/config";
import type { ConfigDejarPasar, ConfigDobleCobro, ReglasVencimiento } from "./cobros-acciones";
import type { ConfigCaja } from "@/app/panel/caja/tipos";
import type { AutoservicioPanel } from "./autoservicio-acciones";
import type { ReglasBeneficiosDatos } from "./ReglasBeneficios";

export const metadata: Metadata = { title: "Configuración" };

export default async function Configuracion({ searchParams }: { searchParams: Promise<{ pestana?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    // E8: todas las lecturas de la pantalla en UN viaje a la base (lote_lecturas), con la lista de cambios restaurables incluida (solo el dueño).
    const [[config, datos, agenda, cierres, mensajes, cambios, tablets, mercadopago, turnosFijos, encuestas, entrada, metaVisitas, vencimiento, dejarPasar, dobleCobro, cajaConfig, autoservicio, planFamiliar, beneficios, restaurables, version, estilo], { pestana }] = await Promise.all([
      rpcLote(
        lectura<Config>("configuracion_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<DatosGimnasio>("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<Agenda>("horarios_apertura_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<CierrePanel[]>("cierres_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<MensajePanel[]>("mensajes_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<Cambio[]>("historial_configuracion", { p_gimnasio_id: panel.gimnasio.id, p_limite: 100 }),
        lectura<Tablet[]>("tablets_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<EstadoMP>("estado_pagos_online", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<boolean>("config_turnos_fijos", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<{ link_resena: string | null }>("encuestas_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<ConfigEntrada>("config_entrada", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<number>("meta_visitas_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<ReglasVencimiento>("reglas_vencimiento", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<ConfigDejarPasar>("config_dejar_pasar", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<ConfigDobleCobro>("config_cobro", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<ConfigCaja>("config_caja", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<AutoservicioPanel>("autoservicio_panel", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<boolean>("plan_familiar_estado", { p_gimnasio_id: panel.gimnasio.id }),
        lectura<Omit<ReglasBeneficiosDatos, "gimnasio_id">>("reglas_beneficios", { p_gimnasio_id: panel.gimnasio.id }),   // VD-46U
        // F9.2 (EDIT-D04): "Restaurar este valor" en Cambios. Solo el dueño y solo si la función está prendida (la base devuelve lista vacía si no).
        panel.yo.rol === "dueno" ? lectura<{ id: string; campo: string; cuando: string }[]>("cambios_restaurables", { p_gimnasio_id: panel.gimnasio.id, p_limite: 100 }) : fijo<{ id: string; campo: string; cuando: string }[]>([]),
        // Cacería (18/11): la versión de la configuración (VD-34) venía en dos viajes más al abrir; ahora en el lote. Si falla, el formulario la pide como antes.
        lectura<{ version: string } | null>("version_registro", { p_gimnasio_id: panel.gimnasio.id, p_tabla: "configuracion", p_id: panel.gimnasio.id }, true),
        // Pase 2.0: la llave de estilo (si la base todavía no la trae, se ve como clásico).
        lectura<{ estilo: "clasico" | "pista"; modo: "claro" | "oscuro" } | null>("estilo_gimnasio", { p_gimnasio_id: panel.gimnasio.id }, true),
      ),
      searchParams,
    ]);
    const idDe = new Map(restaurables.map((r) => [`${r.campo}|${r.cuando}`, r.id]));
    const cambiosConId: Cambio[] = cambios.map((c) => ({ ...c, restaurar_id: idDe.get(`${c.campo}|${c.cuando}`) }));
    const inicial: ClavePestana = PESTANAS.find((p) => p.clave === pestana)?.clave ?? "gimnasio";
    return (
      <>
        <Encabezado icono="ajustes" titulo="Configuración" bajada="Los datos de tu gimnasio, tu marca, cómo cobrás y qué secciones usás." />
        <Ajustes inicial={config} datos={datos} agenda={agenda} cierres={cierres} mensajes={mensajes} cambios={cambiosConId} puedeEditar={panel.yo.rol === "dueno"} pestanaInicial={inicial}
          direccionPagina={await direccionPagina(datos.slug)} tablets={tablets} mercadopago={mercadopago} turnosFijos={turnosFijos}
          linkResena={encuestas.link_resena} entrada={entrada} metaVisitas={metaVisitas} planFamiliar={planFamiliar} vencimiento={vencimiento} dejarPasar={dejarPasar} dobleCobro={dobleCobro} cajaConfig={cajaConfig} autoservicio={autoservicio} beneficios={{ ...beneficios, gimnasio_id: panel.gimnasio.id }} versionInicial={version?.version ?? null} estiloInicial={estilo ?? { estilo: "clasico", modo: "oscuro" }} />
      </>
    );
  });
}
