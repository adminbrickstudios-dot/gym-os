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
const SIN_GIMNASIO_ID = new Set(["gimnasios", "administradores_plataforma", "plataforma_planes", "eventos_webhook", "documentos_legales"]);
const UNIQUE_GLOBAL = new Set([
  "gimnasios_slug_key", "dominios_gimnasio_host_key", "dispositivos_tokens_token_hash_key",
]);
const EJECUTABLES = {
  anon: new Set(["public.gimnasio_por_host", "public.gimnasio_por_slug", "public.landing_publica", "public.agenda_publica", "public.quiero_probar", "public.alta_publica", "public.alta_online", "public.kiosco_estado", "public.kiosco_entrar", "public.kiosco_qr", "public.kiosco_ultimo"]),
  authenticated: new Set([
    "public.gimnasio_por_host", "public.gimnasio_por_slug", "public.landing_publica", "public.estado_acceso", "public.registrar_ingreso", "public.anular_ingreso",
    "public.congelar", "public.descongelar", "public.anular_congelamiento", "public.crear_cierre", "public.anular_cierre",
    "public.precio_cuota", "public.cobrar_cuota", "public.anular_venta", "public.asignar_plan", "public.cambiar_plan",
    "public.dar_de_baja", "public.abrir_caja", "public.cerrar_caja", "public.resumen_caja", "public.caja_abierta", "public.movimiento_caja",
    "public.vender", "public.informar_transferencia", "public.aprobar_pago", "public.rechazar_pago", "public.pagos_por_aprobar",
    "public.retencion", "public.retencion_resumen", "public.registrar_contacto",
    "public.clases_del_dia", "public.reservar", "public.cancelar_reserva", "public.cancelar_clase", "public.tomar_asistencia",
    "public.lista_clase", "public.anular_asistencia",
    "public.mi_sesion", "public.panel_gimnasio", "public.guardar_accesos_rapidos", "public.panel_inicio",
    "public.buscar_socios", "public.ficha_socio", "public.guardar_socio", "public.planes_gimnasio", "public.guardar_plan",
    "public.programar_precio", "public.productos_gimnasio", "public.guardar_producto", "public.ingresos_del_dia",
    "public.configuracion_panel", "public.guardar_configuracion", "public.equipo_gimnasio", "public.guardar_equipo",
    "public.datos_gimnasio_panel", "public.guardar_datos_gimnasio", "public.preparar_imagen_marca", "public.confirmar_imagen_marca",
    "public.quitar_imagen_marca", "public.ordenar_fotos", "public.agenda_publica", "public.horarios_apertura_panel",
    "public.guardar_horarios_apertura", "public.cierres_panel", "public.mensajes_panel", "public.guardar_mensaje",
    "public.restaurar_mensaje", "public.vista_previa_mensaje", "public.primeros_pasos", "public.ocultar_primeros_pasos",
    "public.publicar_pagina", "public.historial_configuracion", "public.pagina_panel", "public.guardar_pagina",
    "public.volver_a_dar_de_alta", "public.notas_y_etiquetas", "public.agregar_nota", "public.borrar_nota", "public.poner_etiqueta", "public.sacar_etiqueta", "public.etiquetas_gimnasio", "public.socios_con_etiqueta", "public.exportar_socios", "public.cumplen_hoy", "public.preparar_foto_socio", "public.confirmar_foto_socio", "public.foto_socio", "public.posibles_duplicados", "public.unir_socios", "public.familia_socio", "public.vincular_familia", "public.sacar_de_familia", "public.pausas_socio", "public.pedir_pausa", "public.resolver_pedido_pausa", "public.pedidos_pausa_pendientes", "public.apto_socio", "public.cargar_apto", "public.anular_apto", "public.filtros_socios", "public.origen_socio", "public.reglamento_aceptado", "public.formas_de_entrada", "public.mi_qr", "public.leer_qr", "public.cupo_dejar_pasar", "public.dejados_pasar", "public.tablets_panel", "public.autorizar_tablet", "public.revocar_tablet", "public.kiosco_estado", "public.kiosco_entrar", "public.kiosco_qr", "public.kiosco_ultimo", "public.entrar_por_qr_pared", "public.usa_qr_pared", "public.asignar_llavero", "public.quitar_llavero", "public.llavero_socio", "public.leer_llavero", "public.registrar_invitado", "public.invitar", "public.confirmar_invitado", "public.anular_invitado", "public.invitados_de_hoy", "public.mis_invitados", "public.control_entrada", "public.lista_precios_plan", "public.programar_lista_precios", "public.anular_precio_programado", "public.vista_aumento", "public.aplicar_aumento", "public.actividades_por_plan", "public.guardar_actividades_plan", "public.guardar_matricula_plan", "public.matriculas_planes", "public.vista_cambio_plan", "public.ventas_socio", "public.anular_venta_panel", "public.pedir_anulacion", "public.pedidos_anulacion_pendientes", "public.resolver_pedido_anulacion", "public.asistencia_socio", "public.revisar_importacion", "public.importar_socios", "public.importaciones_panel", "public.deshacer_importacion", "public.quiero_probar", "public.alta_publica", "public.alta_online", "public.altas_panel", "public.guardar_altas", "public.prospectos_panel", "public.crear_prospecto", "public.actualizar_prospecto", "public.prospecto_es_socio",
    "public.admin_gimnasios", "public.admin_crear_gimnasio", "public.cajas_sede", "public.precios_venta", "public.vencen_hoy",
    "public.actividades_gimnasio", "public.guardar_actividad", "public.horarios_gimnasio", "public.agregar_horario",
    "public.cerrar_horario", "public.clase_detalle", "public.mi_socio",
    "public.admin_entrar_gimnasio", "public.admin_salir_gimnasio", "public.admin_gimnasio", "public.admin_agregar_persona",
    "public.admin_agregar_dominio", "public.admin_quitar_dominio", "public.cuenta_para_nueva_clave", "public.persona_para_dar_acceso",
    "privado.mis_gimnasios", "privado.mi_equipo_id", "privado.soy_admin_plataforma", "privado.es_servicio",
    "privado.mis_socios", "privado.sin_acentos",
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
