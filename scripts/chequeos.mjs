#!/usr/bin/env node
// npm run chequeos — las reglas del proyecto, verificadas contra la base
// y los archivos. Sale con código 1 si alguna falla.
//
// Base: DB_PRUEBAS_URL, o SUPABASE_DB_URL de .env.local, o --url.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));
const iUrl = process.argv.indexOf("--url");
const url = iUrl >= 0 ? process.argv[iUrl + 1] : process.env.DB_PRUEBAS_URL || process.env.SUPABASE_DB_URL;

// ── Listas cerradas de excepciones (docs/SCHEMA.md § Excepciones) ────
const SIN_GIMNASIO_ID = new Set(["gimnasios", "administradores_plataforma", "plataforma_planes", "eventos_webhook", "documentos_legales", "novedades_plataforma", "pedidos_codigo", "intentos_ingreso_fallidos", "pedidos_demo_brik", "plataforma_contacto", "ayudas_usuario", "registro_brik", "favoritos_brik"]);
const UNIQUE_GLOBAL = new Set([
  "gimnasios_slug_key", "dominios_gimnasio_host_key", "dispositivos_tokens_token_hash_key", "eventos_webhook_origen_tipo_id_externo_key",
]);
const EJECUTABLES = {
  anon: new Set(["public.gimnasio_por_host", "public.gimnasio_por_slug", "public.landing_publica", "public.agenda_publica", "public.quiero_probar", "public.alta_publica", "public.alta_online", "public.kiosco_estado", "public.kiosco_emergencia", "public.kiosco_entrar", "public.kiosco_qr", "public.kiosco_ultimo", "public.kiosco_habituales", "public.kiosco_entrar_habitual", "public.kiosco_salida_activa", "public.kiosco_salir", "public.clases_para_probar", "public.reservar_prueba_publica", "public.eventos_publicos", "public.medicion_publica", "public.tv_estado", "public.inscribirse_evento_publico", "public.pedir_demo_brik", "public.planes_brik_publicos", "public.contacto_plataforma_publico", "public.foto_equipo"]),
  authenticated: new Set([
    "public.gimnasio_por_host", "public.gimnasio_por_slug", "public.landing_publica", "public.estado_acceso", "public.registrar_ingreso", "public.anular_ingreso",
    "public.congelar", "public.descongelar", "public.anular_congelamiento", "public.crear_cierre", "public.anular_cierre",
    "public.precio_cuota", "public.cobrar_cuota", "public.anular_venta", "public.asignar_plan", "public.cambiar_plan",
    "public.dar_de_baja", "public.abrir_caja", "public.cerrar_caja", "public.resumen_caja", "public.caja_abierta", "public.movimiento_caja",
    "public.vender", "public.caja_para_cobrar", "public.guardar_doble_cobro", "public.contexto_cobro", "public.config_cobro", "public.guardar_config_cobro", "public.reglas_vencimiento", "public.config_dejar_pasar", "public.guardar_config_dejar_pasar", "public.guardar_regla_vencimiento", "public.guardar_regla_plan", "public.simular_cuota","public.version_registro", "public.verificar_version", "public.informar_transferencia", "public.aprobar_pago", "public.rechazar_pago", "public.pagos_por_aprobar",
    "public.retencion", "public.retencion_resumen", "public.registrar_contacto",
    "public.calcular_devolucion_baja", "public.registrar_devolucion", "public.devolucion_baja_config", "public.guardar_devolucion_baja_modo",
    "public.constancia_baja",
    "public.plan_familiar_estado", "public.guardar_plan_familiar", "public.fijar_titular_familia", "public.quitar_titular_familia", "public.plan_familiar_socio",
    "public.motivos_beneficio_gimnasio", "public.guardar_motivo_beneficio", "public.guardar_topes_beneficios", "public.dar_cortesia", "public.anular_cortesia", "public.cortesias_socio", "public.beneficios_mes",
    "public.suspender_socio", "public.levantar_suspension", "public.revisar_suspension", "public.suspension_socio", "public.moderacion_control",
    "public.config_liquidacion", "public.guardar_config_liquidacion", "public.liquidacion_profes", "public.liquidacion_profe_detalle", "public.mi_liquidacion",
    "public.guardar_regla_profe", "public.cargar_horas_profe", "public.anular_horas_profe", "public.pagar_profe", "public.anular_pago_profe",
    "public.recibo_venta",
    "public.config_cierres", "public.guardar_config_cierres", "public.previsualizar_cierre",
    "public.fichar", "public.fichar_con_pin", "public.config_fichaje", "public.guardar_config_fichaje", "public.mi_fichaje", "public.mis_horas", "public.horas_equipo", "public.fichajes_persona", "public.corregir_fichaje", "public.anular_fichaje",
    "public.clases_del_dia", "public.reservar", "public.cancelar_reserva", "public.cancelar_clase", "public.tomar_asistencia",
    "public.lista_clase", "public.anular_asistencia",
    "public.estado_emergencia_puerta", "public.habilitar_emergencia_puerta", "public.activar_emergencia_puerta", "public.entradas_de_emergencia", "public.cerrar_emergencia_puerta", "public.historial_emergencias_puerta",
    "public.mi_sesion", "public.mi_seguridad", "public.ayudas_vistas", "public.marcar_ayuda", "public.apagar_ayudas", "public.reiniciar_ayudas", "public.panel_gimnasio", "public.guardar_accesos_rapidos", "public.panel_inicio",
    "public.buscar_socios", "public.ficha_socio", "public.guardar_socio", "public.planes_gimnasio", "public.guardar_plan",
    "public.programar_precio", "public.productos_gimnasio", "public.guardar_producto", "public.ingresos_del_dia",
    "public.configuracion_panel", "public.guardar_configuracion", "public.equipo_gimnasio", "public.guardar_equipo",
    "public.datos_gimnasio_panel", "public.guardar_datos_gimnasio", "public.preparar_imagen_marca", "public.confirmar_imagen_marca",
    "public.quitar_imagen_marca", "public.ordenar_fotos", "public.agenda_publica", "public.horarios_apertura_panel",
    "public.guardar_horarios_apertura", "public.cierres_panel", "public.mensajes_panel", "public.guardar_mensaje",
    "public.restaurar_mensaje", "public.vista_previa_mensaje", "public.primeros_pasos", "public.ocultar_primeros_pasos",
    "public.publicar_pagina", "public.historial_configuracion", "public.pagina_panel", "public.guardar_pagina",
    "public.volver_a_dar_de_alta", "public.notas_y_etiquetas", "public.agregar_nota", "public.borrar_nota", "public.poner_etiqueta", "public.sacar_etiqueta", "public.etiquetas_gimnasio", "public.socios_con_etiqueta", "public.exportar_socios", "public.cumplen_hoy", "public.preparar_foto_socio", "public.confirmar_foto_socio", "public.foto_socio", "public.posibles_duplicados", "public.unir_socios", "public.familia_socio", "public.vincular_familia", "public.sacar_de_familia", "public.pausas_socio", "public.pedir_pausa", "public.resolver_pedido_pausa", "public.pedidos_pausa_pendientes", "public.apto_socio", "public.cargar_apto", "public.anular_apto", "public.filtros_socios", "public.origen_socio", "public.reglamento_aceptado", "public.formas_de_entrada", "public.mi_qr", "public.leer_qr", "public.cupo_dejar_pasar", "public.dejados_pasar", "public.tablets_panel", "public.autorizar_tablet", "public.revocar_tablet", "public.kiosco_estado", "public.kiosco_emergencia", "public.kiosco_entrar", "public.kiosco_qr", "public.kiosco_ultimo", "public.entrar_por_qr_pared", "public.usa_qr_pared", "public.asignar_llavero", "public.quitar_llavero", "public.llavero_socio", "public.leer_llavero", "public.registrar_invitado", "public.invitar", "public.confirmar_invitado", "public.anular_invitado", "public.invitados_de_hoy", "public.mis_invitados", "public.control_entrada", "public.lista_precios_plan", "public.programar_lista_precios", "public.anular_precio_programado", "public.vista_aumento", "public.aplicar_aumento", "public.actividades_por_plan", "public.guardar_actividades_plan", "public.guardar_matricula_plan", "public.matriculas_planes", "public.vista_cambio_plan", "public.ventas_socio", "public.comprobante_venta", "public.stock_productos", "public.convenios_gimnasio", "public.historial_caja", "public.preparar_ticket", "public.confirmar_ticket", "public.ticket_movimiento", "public.alertas_caja", "public.cajas_olvidadas", "public.guardar_mi_pin", "public.bandeja_avisos", "public.marcar_avisado", "public.campana", "public.campana_socio", "public.leer_campana", "public.resumen_dueno", "public.resultado_mes", "public.exportar_mes", "public.gastos_mes", "public.guardar_gasto", "public.quitar_gasto", "public.repetir_gastos", "public.guardar_mercadopago", "public.quitar_mercadopago", "public.estado_pagos_online", "public.pago_online_disponible", "public.iniciar_pago_online", "public.pago_online", "public.pago_online_revisable", "public.avisos_pagos_mp", "public.faltas_socio", "public.politica_reservas", "public.guardar_turnos_fijos", "public.abonar_turno", "public.quitar_turno", "public.turnos_socio", "public.horarios_para_turno", "public.config_turnos_fijos", "public.anular_presente", "public.ocupacion_horarios", "public.guardar_wod", "public.wods_socio", "public.editar_horario", "public.tablero_retencion", "public.motivos_baja_mes", "public.racha_socio", "public.mi_historial", "public.pedir_pausa_socio", "privado.faltas_pack", "public.novedades_panel", "public.publicar_novedad", "public.quitar_novedad", "public.novedades_socio", "public.vincular_socios_por_email", "public.mi_link_referido", "public.permisos_equipo", "public.guardar_permisos_equipo", "public.buscar_socios_profe", "public.actividad_equipo", "public.ejercicios_gimnasio", "public.guardar_ejercicio", "public.rutinas_gimnasio", "public.rutina_detalle", "public.guardar_rutina", "public.archivar_rutina", "public.asignar_rutina", "public.quitar_rutina_socio", "public.rutina_de_socio", "public.anotar_ejercicio", "public.anular_registro", "public.progreso_socio", "public.pedidos_baja_pendientes", "public.admin_aplicar_plantilla", "public.admin_salud_gimnasios", "public.admin_novedades", "public.admin_publicar_novedad", "public.admin_retirar_novedad", "public.novedades_dueno", "public.cerrar_novedad_plataforma", "public.estado_abono_panel", "public.admin_planes_brik", "public.admin_guardar_plan_brik", "public.admin_asignar_plan_brik", "public.admin_registrar_pago_brik", "public.admin_anular_pago_brik", "public.admin_abonos", "public.registrar_pedido_codigo", "public.telefono_para_ingresar", "public.sumar_sede", "public.prometieron_pagar", "public.riesgo_baja", "public.primer_mes_socio", "public.avisar_clase", "public.avisos_clase", "public.tareas_panel", "public.crear_tarea", "public.marcar_tarea", "public.retencion_numeros", "public.documentos_panel", "public.guardar_documento", "public.archivar_documento", "public.documentos_socio", "public.firmar_documento", "public.kiosco_habituales", "public.kiosco_entrar_habitual", "public.kiosco_salida_activa", "public.kiosco_salir", "public.registrar_salida", "public.registra_salida", "public.salir_por_qr_pared", "public.config_prueba_gratis", "public.guardar_prueba_gratis", "public.prueba_por_dni", "public.dar_prueba_gratis", "public.anular_prueba_gratis", "public.clases_para_probar", "public.reservar_prueba_publica", "public.crear_evento", "public.eventos_panel", "public.cerrar_evento", "public.eventos_publicos", "public.eventos_socio", "public.guardar_cupon", "public.desactivar_cupon", "public.cupones_panel", "public.validar_cupon", "public.registrar_uso_cupon", "public.guardar_link_resena", "public.encuesta_socio", "public.responder_encuesta", "public.encuestas_panel", "public.medicion_panel", "public.guardar_medicion", "public.prueba_social_panel", "public.guardar_prueba_social", "public.medicion_publica", "public.guardar_lugares", "public.lugares_clase", "public.elegir_lugar", "public.grados_panel", "public.guardar_grado", "public.archivar_grado", "public.otorgar_grado", "public.anular_grado_socio", "public.grados_socio", "public.crear_tv", "public.revocar_tv", "public.tvs_panel", "public.tv_estado", "public.copia_entrada", "public.sincronizar_sin_internet", "public.exportar_gimnasio", "public.dar_de_baja_equipo", "public.registrar_sesion_equipo", "public.seguridad_dueno", "public.marcar_alertas_vistas", "public.datos_ejemplo", "public.cargar_socios_ejemplo", "public.borrar_socios_ejemplo", "public.mis_datos", "public.anonimizar_socio", "public.pedir_baja_socio", "public.pedido_baja_socio", "public.resolver_pedido_baja", "public.guardar_suscripcion_push", "public.borrar_suscripcion_push", "public.suscripcion_push", "public.entrar_con_pin", "public.operador_actual", "public.guardar_convenio", "public.asignar_convenio", "public.quitar_convenio", "public.convenio_socio", "public.configurar_stock", "public.entrada_stock", "public.contar_stock", "public.movimientos_stock_producto", "public.anular_venta_panel", "public.pedir_anulacion", "public.pedidos_anulacion_pendientes", "public.resolver_pedido_anulacion", "public.asistencia_socio", "public.revisar_importacion", "public.importar_socios", "public.importaciones_panel", "public.deshacer_importacion", "public.quiero_probar", "public.alta_publica", "public.alta_online", "public.altas_panel", "public.guardar_altas", "public.prospectos_panel", "public.crear_prospecto", "public.actualizar_prospecto", "public.prospecto_es_socio", "public.numeros_inicio", "public.guardar_numeros_inicio", "public.pestanas_app", "public.progreso_inicio", "public.marcar_bienvenida", "public.config_entrada", "public.guardar_config_entrada", "public.guia_entrada", "public.planes_para_alta", "public.prospecto_por_telefono", "public.prospecto_por_dni", "public.autoaltas_web","public.ultimas_entradas", "public.para_hacer_hoy", "public.meta_visitas_panel", "public.guardar_meta_visitas", "public.config_visita", "public.guardar_config_visita", "public.alertas_prestamo", "public.entradas_desde", "public.config_caja", "public.guardar_config_caja", "public.mi_turno_caja", "public.cajas_para_revisar", "public.contar_caja_sin_contar", "public.dejar_caja_sin_contar", "public.reporte_turno", "public.reporte_dia", "public.ganancia_mes", "public.cargar_gasto", "public.anular_gasto", "public.preparar_comprobante_gasto", "public.confirmar_comprobante_gasto", "public.comprobante_gasto", "public.guardar_gasto_fijo", "public.terminar_gasto_fijo", "public.guardar_presupuesto_gasto", "public.guardar_permiso_gastos", "public.exportar_gastos", "public.linea_de_control", "public.campana_control", "public.checklist_hoy", "public.guardar_checklist_item", "public.tildar_checklist", "public.tareas_auto_config", "public.guardar_tarea_auto", "public.pendientes_panel", "public.campana_panel", "public.preferencias_aviso_panel", "public.guardar_preferencia_aviso", "public.permisos_mensajes", "public.guardar_permisos_mensajes", "public.mensajes_estado_socio", "public.escribir_al_gimnasio", "public.responder_hilo_socio", "public.mis_mensajes", "public.mi_hilo", "public.preparar_foto_mensaje", "public.confirmar_foto_mensaje", "public.foto_mensaje", "public.bandeja_mensajes", "public.hilo_mensajes", "public.responder_mensaje", "public.cambiar_estado_hilo", "public.historial_mensajes_socio", "public.mensajes_sin_responder", "public.ver_mensajes_equipo", "public.respuestas_rapidas", "public.guardar_respuesta_rapida", "public.quitar_respuesta_rapida", "privado.puede_ver_mensajes", "public.registro_socios_panel", "public.guardar_registro_socios", "public.opciones_compra_app", "public.vista_compra_app", "public.informar_compra_app", "public.iniciar_compra_online", "public.autoservicio_panel", "public.guardar_compras_app", "public.motivo_reserva", "public.motivos_reserva", "public.avisos_lugar_socio", "public.marcar_plantilla", "public.copiar_rutina", "public.asignar_rutina_varios", "public.marcar_dia_rutina", "public.desmarcar_dia_rutina", "public.rutinas_progreso_equipo", "public.publicar_evento", "public.inscribirse_evento", "public.cancelar_inscripcion_evento", "public.inscribirse_evento_publico", "public.evento_marcar_presente", "public.evento_quitar_presente", "public.eventos_del_dia_socio", "public.info_gimnasio_socio",
    "public.admin_gimnasios", "public.admin_crear_gimnasio", "public.cajas_sede", "public.precios_venta", "public.vencen_hoy", "public.vencen_pestanas", "public.retencion_periodo",
    "public.actividades_gimnasio", "public.guardar_actividad", "public.horarios_gimnasio", "public.agregar_horario",
    "public.cerrar_horario", "public.clase_detalle", "public.mi_socio",
    "public.admin_entrar_gimnasio", "public.admin_salir_gimnasio", "public.estado_soporte", "public.soportes_del_gimnasio", "public.admin_soportes",
    "public.admin_salud_v2", "public.admin_uso_semanal", "public.admin_metricas", "public.pedir_ayuda_brik", "public.admin_ayudas",
    "public.admin_resolver_ayuda", "public.pedir_demo_brik", "public.planes_brik_publicos", "public.admin_pedidos_demo", "public.admin_atender_demo", "public.admin_guardar_contacto_plataforma", "public.contacto_plataforma_publico", "public.guardar_video_portada", "public.admin_guardar_marca", "public.admin_notas", "public.admin_agregar_nota","public.admin_gimnasio", "public.admin_agregar_persona",
    "public.admin_agregar_dominio", "public.admin_quitar_dominio", "public.cuenta_para_nueva_clave", "public.persona_para_dar_acceso",
    "public.servicios_gimnasio", "public.guardar_servicio", "public.asignar_servicio", "public.ajustes_planes", "public.guardar_ajustes_plan", "public.ordenar_planes",
    "public.productos_mostrador", "public.guardar_ficha_producto", "public.preparar_foto_producto", "public.confirmar_foto_producto", "public.quitar_foto_producto",
    "public.preparar_remito_stock", "public.confirmar_remito_stock", "public.remito_stock",
    "public.equipo_perfiles", "public.guardar_equipo_ajuste", "public.guardar_perfil_equipo", "public.preparar_foto_equipo", "public.guardar_foto_equipo", "public.foto_equipo", "public.profes_de_clases",
    "public.config_aumento", "public.guardar_config_aumento", "public.aviso_previo_aumento", "public.aumentos_hechos", "public.mis_avisos", "public.marcar_aviso_leido", "public.deuda_con_socios", "public.resultado_por_sede", "public.firmas_propias_pendientes",
    "privado.mis_gimnasios", "privado.mi_equipo_id", "privado.soy_admin_plataforma", "privado.es_servicio",
    "privado.mis_socios", "privado.sin_acentos",
    "public.reemplazar_profe", "public.reemplazos_clase",   // VD-46K
    "public.perdonar_falta", "public.perdonar_bloqueo", "public.faltas_socio_detalle", "public.faltas_clase",   // VD-46Q
    "public.crear_incidente", "public.corregir_incidente", "public.incidentes_panel", "privado.es_gestion_de",   // VD-46I
    "public.marcar_no_escribirle", "public.no_escribirle_socio",   // VD-46N
    "public.ex_socios",   // VD-46O
    "public.anular_devolucion", "public.devoluciones_socio", "public.reglas_beneficios",   // VD-46U
    "public.crear_maquina", "public.dar_de_baja_maquina", "public.reportar_falla", "public.asignar_responsable_falla", "public.arreglar_falla",   // VD-54
    "public.preparar_foto_falla", "public.confirmar_foto_falla", "public.foto_falla", "public.maquinas_panel", "public.historial_maquina", "public.maquinas_fuera_de_servicio",
    "public.crear_locker", "public.crear_lockers_serie", "public.dar_de_baja_locker", "public.guardar_tarifa_locker", "public.alquilar_locker",   // VD-55
    "public.renovar_alquiler_locker", "public.liberar_locker", "public.lockers_panel", "public.mi_locker", "public.lockers_vencen_semana",
    "public.guardar_pack_pt", "public.guardar_config_pt", "public.cargar_franjas_pt", "public.quitar_franja_pt", "public.reservar_sesion_pt",   // VD-58
    "public.cancelar_sesion_pt", "public.marcar_sesion_pt", "public.agenda_pt", "public.pt_socio", "public.sesiones_dictadas_pt",
  ]),
};

const resultados = [];
const chequeo = (nombre, problemas) => resultados.push({ nombre, problemas });

// ── Archivos ─────────────────────────────────────────────────────────
const carpetaMig = join(raiz, "supabase", "migrations");
const migraciones = readdirSync(carpetaMig).filter((f) => f.endsWith(".sql")).sort();
const conTodo = [], conTransaccion = [], malNombre = [];
for (const f of migraciones) {
  const sql = readFileSync(join(carpetaMig, f), "utf8");
  if (/\b(TODO|FIXME|XXX)\b/.test(sql)) conTodo.push(f);
  if (/^\s*(begin|commit)\s*;/im.test(sql.replace(/\$\$[\s\S]*?\$\$/g, ""))) conTransaccion.push(f);
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(f)) malNombre.push(f);
}
chequeo("Ningún TODO en migraciones", conTodo);
chequeo("Ninguna migración abre su propia transacción", conTransaccion);
chequeo("Migraciones con nombre AAAAMMDDHHMMSS_nombre.sql", malNombre);

const telefonosReales = [];
const carpetaDatos = join(raiz, "scripts", "datos");
for (const f of readdirSync(carpetaDatos)) {
  const texto = readFileSync(join(carpetaDatos, f), "utf8");
  for (const m of texto.matchAll(/\+?54\s?9?\s?(\d[\d\s-]{7,})/g)) {
    const digitos = m[0].replace(/\D/g, "");
    if (!/^5490{3}/.test(digitos) && !/^540{3}/.test(digitos)) telefonosReales.push(`${f}: ${m[0].trim()}`);
  }
}
chequeo("Datos de prueba sin teléfonos con pinta de reales (+549000…)", telefonosReales);

// ── Base ─────────────────────────────────────────────────────────────
if (!url) {
  chequeo("Conexión a la base", ["Falta DB_PRUEBAS_URL o SUPABASE_DB_URL: no se revisó la base"]);
} else {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const q = async (sql) => (await db.query(sql)).rows;

  chequeo("RLS activa en toda tabla de public", (await q(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity order by 1`)).map((r) => r.relname));

  chequeo("gimnasio_id en toda tabla (salvo la lista de excepciones)", (await q(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'gimnasio_id' and not a.attisdropped)
     order by 1`)).map((r) => r.relname).filter((t) => !SIN_GIMNASIO_ID.has(t)));

  chequeo("FK entre tablas con gimnasio_id son compuestas (incluyen gimnasio_id)", (await q(`
    select con.conname, c.relname as tabla, r.relname as ref
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
      join pg_class r on r.oid = con.confrelid join pg_namespace rn on rn.oid = r.relnamespace
     where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
       and r.relname <> 'gimnasios'
       and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'gimnasio_id')
       and exists (select 1 from pg_attribute a where a.attrelid = r.oid and a.attname = 'gimnasio_id')
       and not exists (select 1 from unnest(con.conkey) k join pg_attribute a on a.attrelid = c.oid and a.attnum = k
                        where a.attname = 'gimnasio_id')
     order by 1`)).map((r) => `${r.tabla} → ${r.ref} (${r.conname})`));

  chequeo("Ninguna fecha 'timestamp' sin zona", (await q(`
    select table_name || '.' || column_name as col from information_schema.columns
     where table_schema in ('public','privado') and data_type = 'timestamp without time zone' order by 1`)).map((r) => r.col));

  chequeo("Plata en numeric(12,2)", (await q(`
    select table_name || '.' || column_name || ' (' || data_type || coalesce('(' || numeric_precision || ',' || numeric_scale || ')', '') || ')' as col
      from information_schema.columns
     where table_schema = 'public'
       and column_name ~ '^(monto|precio|descuento|para_regularizar)' and column_name !~ '(_motivo|_max_recepcion)$'
       and not (data_type = 'numeric' and numeric_precision = 12 and numeric_scale = 2)
     order by 1`)).map((r) => r.col));

  chequeo("Toda función con search_path fijo", (await q(`
    select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public','privado') and p.prokind = 'f'
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
     order by 1`)).map((r) => r.f));

  const ejecutables = await q(`
    select distinct rol, n.nspname || '.' || p.proname as f
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      cross join (values ('anon'), ('authenticated')) as r(rol)
     where n.nspname in ('public','privado') and p.prokind = 'f'
       and has_schema_privilege(rol, n.oid, 'usage')
       and has_function_privilege(rol, p.oid, 'execute')
     order by 1, 2`);
  chequeo("Solo se ejecuta lo que está en la lista blanca (REVOKE en el resto)",
    ejecutables.filter((r) => !EJECUTABLES[r.rol].has(r.f)).map((r) => `${r.rol}: ${r.f}`));

  chequeo("Todo unique es por gimnasio (salvo la lista de excepciones)", (await q(`
    select i.relname as indice, c.relname as tabla
      from pg_index x
      join pg_class i on i.oid = x.indexrelid
      join pg_class c on c.oid = x.indrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and x.indisunique and not x.indisprimary
       and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'gimnasio_id')
       and not exists (select 1 from unnest(x.indkey) k join pg_attribute a on a.attrelid = c.oid and a.attnum = k
                        where a.attname = 'gimnasio_id')
     order by 1`)).map((r) => `${r.tabla}: ${r.indice}`).filter((s) => !UNIQUE_GLOBAL.has(s.split(": ")[1])));

  chequeo("Nadie del lado del cliente tiene TRUNCATE, REFERENCES ni TRIGGER", (await q(`
    select rol || ': ' || c.relname || ' ' || priv as p
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('anon'), ('authenticated')) r(rol)
      cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) x(priv)
     where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege(rol, c.oid, priv)
     order by 1`)).map((r) => r.p));

  // BASE-5: la vigencia guardada nunca queda vieja: lo guardado es lo que dan los hechos, para todos los socios.
  chequeo("socios.cubierto_hasta guardado = recalculado desde las coberturas", (await q(`
    select s.id::text || ' guardado ' || coalesce(s.cubierto_hasta::text, 'null') || ' recalculado ' || coalesce(privado.calcular_cubierto_hasta(s.id)::text, 'null') as p
      from public.socios s where s.cubierto_hasta is distinct from privado.calcular_cubierto_hasta(s.id) limit 20`)).map((r) => r.p));

  chequeo("Gimnasios demo sin teléfonos con pinta de reales", (await q(`
    select s.telefono from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
     where g.es_demo and s.telefono is not null and s.telefono not like '+549000%' limit 20`)).map((r) => r.telefono));

  await db.end();
}

// ── Reporte ──────────────────────────────────────────────────────────
let fallas = 0;
for (const r of resultados) {
  const ok = r.problemas.length === 0;
  if (!ok) fallas++;
  console.log(`${ok ? "✓" : "✗"} ${r.nombre}`);
  for (const p of r.problemas.slice(0, 15)) console.log(`    ${p}`);
  if (r.problemas.length > 15) console.log(`    … y ${r.problemas.length - 15} más`);
}
console.log(fallas ? `\n${fallas} chequeo(s) en rojo.` : "\nTodo en verde.");
process.exit(fallas ? 1 : 0);
