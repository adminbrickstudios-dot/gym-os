#!/usr/bin/env node
// F8.4 · Arma el "Gimnasio Prueba Mateo" [demo]: el gimnasio donde Mateo hace su pasada visual y la prueba del dueño
// (docs/base/PRUEBA-DUENO.md). Con marca propia, 3 planes que se venden (más los de los casos testigo), 30 socios en todos los
// estados, clases con reserva, una recepcionista y un profe, productos de mostrador, página publicada y movimientos de caja.
//
//   node scripts/datos/sembrar-prueba-mateo.mjs --url postgres://… [--dominio gym-os-pied.vercel.app] [--hoy 2026-11-14]
//
// Reglas (están en el código):
//   · Solo crea. Toca únicamente el gimnasio de slug `demo-mateo` (es_demo = true, nombre "[demo] Gimnasio Prueba Mateo"). Nunca lee ni
//     escribe datos de otro gimnasio (ni de Temple Gym). Si `demo-mateo` ya existe NO lo rehace: lo dice y sale bien (idempotente).
//   · Datos obviamente ficticios: teléfonos +54 9 000…, mails @ejemplo.invalid, DNI 39xxxxxx.
//   · Sin contraseñas: los logins los crea scripts/datos/usuarios-demo.mjs --prueba con una contraseña que viene por secreto.
//   · Los 30 socios incluyen los casos testigo (scripts/datos/casos-testigo.mjs, única fuente de sus nombres) y completan hasta 30 con
//     socios comunes (al día, por vencer, en tolerancia, debe, nunca pagó).
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { sembrarCasos, sumarDias, PLANES_TESTIGO } from "./casos-testigo.mjs";
import { sembrarLanding, LANDING_DEMO } from "./landing-demo.mjs";

export const SLUG_PRUEBA_MATEO = "demo-mateo";
export const NOMBRE_PRUEBA_MATEO = "[demo] Gimnasio Prueba Mateo";
export const TOTAL_SOCIOS = 30;

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg("url", process.env.DB_PRUEBAS_URL || process.env.SUPABASE_DB_URL);
const dominio = (arg("dominio", "") || "").toLowerCase();
const ZONA = "America/Argentina/Buenos_Aires";
const hoy = arg("hoy", new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date()));
if (!url) { console.error("Falta --url o DB_PRUEBAS_URL / SUPABASE_DB_URL"); process.exit(1); }

let semilla = 20261112;
const azar = () => { semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));

const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;

const [ya] = await q("select id from public.gimnasios where slug = $1", [SLUG_PRUEBA_MATEO]);
if (ya) {
  const [{ n }] = await q("select count(*)::int as n from public.socios where gimnasio_id = $1", [ya.id]);
  console.log(`El ${NOMBRE_PRUEBA_MATEO} ya existe (${n} socios): no se rehace. Para empezar de cero hay que darlo de baja desde /admin y borrarlo a mano.`);
  await db.end(); process.exit(0);
}

const t0 = Date.now();
await db.query("begin");
try {
  const [{ id: g }] = await q(`insert into public.gimnasios (slug, nombre, es_demo) values ($1, $2, true) returning id`, [SLUG_PRUEBA_MATEO, NOMBRE_PRUEBA_MATEO]);
  const [{ id: sede }] = await q("select id from public.sedes where gimnasio_id = $1", [g]);

  // Marca: colores propios (cálido, para distinguirlo de los otros demos), alias ficticio, clases con reserva.
  await q(`update public.configuracion_gimnasio set color_acento = '#f0883e', color_fondo = '#181310', cobra_pack = true,
             accesos_activos = array['recepcion','qr_socio','kiosco'], modo_clases = 'reserva', prueba_gratis = 'dia',
             alias_transferencia = 'PRUEBA.MATEO.EJEMPLO', titular_cuenta = 'Gimnasio Prueba Mateo (ficticio)'
           where gimnasio_id = $1`, [g]);
  if (dominio) await q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio') on conflict do nothing`, [g, `${SLUG_PRUEBA_MATEO}.${dominio}`]);

  // Página: la del demo, con otro titular.
  await sembrarLanding(db, g, { ...LANDING_DEMO, portada: { ...LANDING_DEMO.portada, titulo: "Gimnasio Prueba Mateo: entrená a tu ritmo",
    bajada: "Un gimnasio de prueba para mirar cómo se ve Base de punta a punta. Todo lo que ves es ficticio." } });

  // Planes: los testigo (seis) y, de ésos, tres a la venta en la página (Full, 3 veces, Mañana), con descripción y orden.
  const casos = await sembrarCasos(db, { gimnasioId: g, sedeId: sede, hoy, telefonoBase: 5490000500000 });
  const planes = casos.planes;
  await q(`update public.planes set visible_en_landing = (nombre in ('Plan Full', 'Plan 3 veces', 'Plan Mañana')),
             descripcion = case nombre when 'Plan Full' then 'Pase libre a todo, todos los días.' when 'Plan Mañana' then 'De 7 a 12, ideal si entrenás antes de trabajar.'
               when 'Plan 3 veces' then 'Tres días por semana, los que elijas.' else descripcion end,
             orden = case nombre when 'Plan Full' then 1 when 'Plan 3 veces' then 2 when 'Plan Mañana' then 3 when 'Pack 10 clases' then 4 else 5 end
           where gimnasio_id = $1`, [g]);
  const nTestigos = Object.keys(casos.socios).length;

  // Mostrador, clases (cuatro actividades, grilla de lunes a sábado), horarios de apertura, equipo.
  for (const [i, [nombre, precio]] of [["Agua 500 ml", 1500], ["Bebida isotónica", 2800], ["Barrita proteica", 3200], ["Candado para locker", 6500]].entries()) {
    await q(`insert into public.productos (gimnasio_id, nombre, precio, orden) values ($1,$2,$3,$4)`, [g, nombre, precio, i]);
  }
  const act = {};
  for (const [nombre, emoji, descripcion] of [["Spinning", "🚴", "45 minutos a pura música"], ["Funcional", "🔥", "Fuerza y cardio en circuito"], ["Yoga", "🧘", "Movilidad y respiración"], ["Crossfit", "🏋️", "WOD del día, en equipo"]]) {
    [{ id: act[nombre] }] = await q(`insert into public.actividades (gimnasio_id, nombre, emoji, descripcion) values ($1,$2,$3,$4) returning id`, [g, nombre, emoji, descripcion]);
  }
  // Equipo: una recepcionista y un profe (usuarios-demo --prueba les vincula el login).
  await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, 'Ana Prueba', 'recepcion')`, [g]);
  const [{ id: profe }] = await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, 'Diego Prueba', 'profe') returning id`, [g]);
  const grilla = [["Spinning", "08:00", 45, 15], ["Funcional", "09:00", 60, 20], ["Yoga", "10:30", 60, 12], ["Crossfit", "18:00", 60, 16], ["Spinning", "19:00", 45, 15], ["Funcional", "20:00", 60, 20]];
  for (let dia = 1; dia <= 6; dia++) for (const [a, hora, dur, cupo] of grilla) {
    if (dia === 6 && hora > "12:00") continue;
    await q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, profe_id, vigente_desde)
             values ($1,$2,$3,$4,$5,$6,$7,$8,'2026-01-01')`, [g, sede, act[a], dia, hora, dur, cupo, ["Funcional", "Crossfit"].includes(a) ? profe : null]);
  }
  for (let dia = 1; dia <= 6; dia++) {
    await q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,$3,$4,$5)`, [g, sede, dia, dia === 6 ? "09:00" : "07:00", dia === 6 ? "14:00" : "23:00"]);
  }

  // Socios comunes hasta completar 30: perfiles repartidos para que la lista tenga de todo.
  const medianoche = async (dia) => (await q("select privado.medianoche($1::date, $2) as t", [dia, ZONA]))[0].t;
  const precioFull = PLANES_TESTIGO.find((p) => p.clave === "full").precio;
  const NOMBRES = ["Lucía", "Martina", "Sofía", "Valentina", "Camila", "Mateo", "Santiago", "Benjamín", "Joaquín", "Tomás", "Rocío", "Antonella"];
  const PERFILES = [["al_dia", 14], ["al_dia", 20], ["al_dia", 8], ["por_vencer", 2], ["por_vencer", 3], ["tolerancia", -2], ["debe", -12], ["debe", -35], ["nunca", 0], ["al_dia", 25], ["debe", -60]];
  const faltan = TOTAL_SOCIOS - nTestigos;
  let enPrueba = null;
  for (let i = 0; i < faltan; i++) {
    const [perfil, fin] = PERFILES[i % PERFILES.length];
    const [{ id: s }] = await q(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, creado_en)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [g, NOMBRES[i % NOMBRES.length], `Prueba ${String(i + 1).padStart(2, "0")}`, String(39000001 + i), `+549000${String(3000001 + i)}`, `prueba${i + 1}@ejemplo.invalid`,
       `${entre(1970, 2004)}-${String(entre(1, 12)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}`, await medianoche(sumarDias(hoy, -entre(40, 400)))]);
    if (perfil === "nunca") { enPrueba = s; continue; }   // sin plan ni pago: "sin pago"/"sin plan" ya están en los testigos, acá queda alguien que recién llegó
    const [{ id: su }] = await q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`, [g, s, planes.full, await medianoche(sumarDias(hoy, fin - 90))]);
    for (let m = 0; m < 3; m++) {
      const dDesde = fin - 90 + m * 30, dHasta = m === 2 ? fin : dDesde + 30;
      const desde = await medianoche(sumarDias(hoy, dDesde)), hasta = await medianoche(sumarDias(hoy, dHasta));
      const [{ id: v }] = await q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_en) values ($1,$2,$3,'confirmada','recepcion',$4,$4) returning id`, [g, sede, s, desde]);
      const [{ id: it }] = await q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, precio_unitario) values ($1,$2,'cuota',$3,$4,'Cuota mensual',$5) returning id`, [g, v, planes.full, su, precioFull]);
      await q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en) values ($1,$2,$3,$4,'aprobado',$5,$5)`, [g, v, ["efectivo", "transferencia", "debito"][m % 3], precioFull, desde]);
      await q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id) values ($1,$2,$3,$4,$5,'pago',$6)`, [g, su, s, desde, hasta, it]);
    }
    // Ingresos de los últimos días mientras estuvo cubierto.
    for (let d = -14; d < 0; d++) {
      if (d >= fin || azar() > 0.5) continue;
      await q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
               values ($1,$2,$3, privado.medianoche($4::date, $5) + $6::interval, 'recepcion','entro','membresia','verde','al_dia','Al día')`,
        [g, sede, s, sumarDias(hoy, d), ZONA, `${[7, 9, 12, 18, 19, 20][entre(0, 5)]}:${String(entre(0, 59)).padStart(2, "0")}`]);
    }
  }

  // Un socio en prueba gratis hoy (el que nunca pagó): "en prueba" en la puerta.
  if (enPrueba) {
    await q(`insert into public.pruebas_gratis (gimnasio_id, dni, nombre, modo, sede_id, desde, hasta, origen, socio_id)
             select $1, s.dni, s.nombre || ' ' || s.apellido, 'dia', $2, $3, $4, 'entrada', s.id from public.socios s where s.id = $5`,
      [g, sede, await medianoche(hoy), await medianoche(sumarDias(hoy, 1)), enPrueba]);
  }

  // Interesados, para que Socios → Interesados no esté vacío.
  for (const [nombre, tel, interes, origen, estado, dias] of [["Valentina Ruiz", "+5490000200001", "Funcional a la mañana", "pagina", "nuevo", 0], ["Tomás Ibarra", "+5490000200002", "Musculación", "pagina", "nuevo", 1],
    ["Micaela Sosa", "+5490000200003", "Spinning", "recepcion", "contactado", 2], ["Joaquín Paz", "+5490000200004", null, "referido", "vino", 4]]) {
    await q(`insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, estado, creado_en, actualizado_en) values ($1,$2,$3,$4,$5,$6, now() - make_interval(days => $7), now() - make_interval(days => $7))`, [g, nombre, tel, interes, origen, estado, dias]);
  }

  // Verificación: 30 socios y el veredicto de cada uno, calculado por la función de siempre (nunca guardado).
  const [{ n }] = await q("select count(*)::int as n from public.socios where gimnasio_id = $1", [g]);
  if (n !== TOTAL_SOCIOS) throw new Error(`Se esperaban ${TOTAL_SOCIOS} socios y hay ${n}`);
  const colores = await q(`select (x).color as color, (x).motivo as motivo, count(*)::int as n
      from (select privado.calcular_acceso(s.id, now(), $2) as x from public.socios s where s.gimnasio_id = $1) y group by 1, 2 order by 1, 2`, [g, sede]);
  await db.query("commit");
  console.log(`${NOMBRE_PRUEBA_MATEO} sembrado en ${((Date.now() - t0) / 1000).toFixed(1)} s (hoy = ${hoy}): ${n} socios (${nTestigos} casos testigo + ${faltan} comunes).`);
  console.log("Veredicto de la puerta ahora:", colores.map((c) => `${c.color}/${c.motivo} ${c.n}`).join(", "));
} catch (e) {
  await db.query("rollback");
  console.error("Falló la siembra, no quedó nada a medias:", e.message);
  process.exitCode = 1;
}
await db.end();
