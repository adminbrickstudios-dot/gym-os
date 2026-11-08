#!/usr/bin/env node
// Siembra el gimnasio demo: datos OBVIAMENTE ficticios, para probar con
// volumen real, para las capturas y para mostrarle el sistema a un prospecto.
//
//   node scripts/datos/sembrar-demo.mjs --url postgres://... [--socios 300] [--hoy 2026-11-14] [--dominio midominio.com]
//
// Crea: el gimnasio "Gimnasio Demo" (slug demo, es_demo = true), los
// planes testigo, los casos testigo (un socio por respuesta posible) y
// N socios más con vencimientos variados e ingresos de los últimos 3
// meses en horarios realistas. Teléfonos +549000…, mails @ejemplo.invalid.
// Es determinístico: la misma semilla da los mismos datos.
// Se niega a correr si el gimnasio demo ya existe.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { sembrarCasos, sumarDias, PLANES_TESTIGO } from "./casos-testigo.mjs";
import { sembrarLanding, LANDING_DEMO } from "./landing-demo.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg("url", process.env.DB_PRUEBAS_URL || process.env.SUPABASE_DB_URL);
const cantidad = Number(arg("socios", "300"));
// Dominio base de los demos: demo.<dominio> y demo-box.<dominio>. Con el dominio real, --dominio midominio.com
const dominio = arg("dominio", "localhost").toLowerCase();
const ZONA = "America/Argentina/Buenos_Aires";
const hoy = arg("hoy", new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date()));

if (!url) { console.error("Falta --url o DB_PRUEBAS_URL / SUPABASE_DB_URL"); process.exit(1); }

// PRNG determinístico (mulberry32)
let semilla = 20261029;
const azar = () => { semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
const uno = (xs) => xs[Math.floor(azar() * xs.length)];

const NOMBRES = ["Lucía", "Martina", "Sofía", "Valentina", "Camila", "Julieta", "Florencia", "Agustina", "Micaela", "Carolina",
  "Mateo", "Santiago", "Benjamín", "Joaquín", "Tomás", "Facundo", "Nicolás", "Matías", "Lautaro", "Franco",
  "Rocío", "Antonella", "Milagros", "Paula", "Daniela", "Gonzalo", "Ramiro", "Ezequiel", "Federico", "Iván"];
const APELLIDOS = ["Demo", "Ficticio", "Ejemplo", "Prueba", "Inventado", "Muestra", "Simulado", "Ensayo", "Modelo", "Borrador"];

const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;

const existe = await q("select id from public.gimnasios where slug = 'demo'");
if (existe.length) {
  console.error("El gimnasio demo ya existe. Para empezar de cero, recreá la base local (scripts/db/local.sh nueva).");
  await db.end(); process.exit(1);
}

const t0 = Date.now();
await db.query("begin");
try {
  const [{ id: g }] = await q(`insert into public.gimnasios (slug, nombre, es_demo) values ('demo', 'Gimnasio Demo', true) returning id`);
  const [{ id: sede }] = await q("select id from public.sedes where gimnasio_id = $1", [g]);
  // BASE-3 (D40): el demo conserva la ventana grande del veredicto porque los recorridos viejos (vd-1, vd-6…) la usan; los gimnasios nuevos arrancan con aviso.
  await q(`insert into public.configuracion_entrada (gimnasio_id, resultado_entrada) values ($1, 'ventana') on conflict (gimnasio_id) do update set resultado_entrada = 'ventana'`, [g]);
  await q(`update public.configuracion_gimnasio set cobra_pack = true, accesos_activos = array['recepcion','qr_socio','kiosco'],
             alias_transferencia = 'GYM.DEMO.EJEMPLO', titular_cuenta = 'Gimnasio Demo (ficticio)' where gimnasio_id = $1`, [g]);
  await q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [g, `demo.${dominio}`]);

  const { planes, socios: testigos } = await sembrarCasos(db, { gimnasioId: g, sedeId: sede, hoy, telefonoBase: 5490000100000 });
  await sembrarLanding(db, g);
  // Los planes testigo son para probar; en la landing quedan los que vende un gimnasio real.
  await q(`update public.planes set visible_en_landing = false where gimnasio_id = $1 and nombre in ('Pack 5 clases')`, [g]);
  await q(`update public.planes set descripcion = case nombre
             when 'Plan Full' then 'Pase libre a todo, todos los días.'
             when 'Plan Mañana' then 'De 7 a 12, ideal si entrenás antes de trabajar.'
             when 'Plan 3 veces' then 'Tres días por semana, los que elijas.'
             when 'Pase diario' then 'Un día, sin compromiso.'
             when 'Pack 10 clases' then 'Diez clases para usar en dos meses.' end,
             orden = case nombre when 'Plan Full' then 1 when 'Plan 3 veces' then 2 when 'Plan Mañana' then 3
                                 when 'Pack 10 clases' then 4 else 5 end
           where gimnasio_id = $1`, [g]);
  await q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, medio_pago) values ($1, $2, 22000, '2020-01-01', 'efectivo')`,
    [g, planes.full]);

  // Lo que se vende en el mostrador además de los planes.
  for (const [i, [nombre, precio]] of [["Agua 500 ml", 1500], ["Bebida isotónica", 2800], ["Barrita proteica", 3200], ["Candado para locker", 6500]].entries()) {
    await q(`insert into public.productos (gimnasio_id, nombre, precio, orden) values ($1,$2,$3,$4)`, [g, nombre, precio, i]);
  }

  // Clases con reserva: actividades y una grilla de lunes a sábado (las clases de cada día se crean solas).
  await q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [g]);
  const actividades = {};
  for (const [nombre, emoji, descripcion] of [["Spinning", "🚴", "45 minutos a pura música"], ["Funcional", "🔥", "Fuerza y cardio en circuito"],
                                               ["Yoga", "🧘", "Movilidad y respiración"], ["Crossfit", "🏋️", "WOD del día, en equipo"]]) {
    [{ id: actividades[nombre] }] = await q(`insert into public.actividades (gimnasio_id, nombre, emoji, descripcion) values ($1,$2,$3,$4) returning id`,
      [g, nombre, emoji, descripcion]);
  }
  // El profe existe antes que la grilla (un horario no se edita); usuarios-demo le vincula el login.
  const [{ id: diego }] = await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, 'Diego', 'profe') returning id`, [g]);
  const grilla = [["Spinning", "08:00", 45, 15], ["Funcional", "09:00", 60, 20], ["Yoga", "10:30", 60, 12],
                  ["Crossfit", "18:00", 60, 16], ["Spinning", "19:00", 45, 15], ["Funcional", "20:00", 60, 20]];
  for (let dia = 1; dia <= 6; dia++) {
    for (const [act, hora, dur, cupo] of grilla) {
      if (dia === 6 && hora > "12:00") continue;   // los sábados, solo a la mañana
      await q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, profe_id, vigente_desde)
               values ($1,$2,$3,$4,$5,$6,$7,$8,'2026-01-01')`, [g, sede, actividades[act], dia, hora, dur, cupo, ["Funcional", "Crossfit"].includes(act) ? diego : null]);
    }
  }

  // Horarios de apertura: lunes a viernes de 7 a 23, sábados de 9 a 14 (domingo cerrado).
  for (let dia = 1; dia <= 6; dia++) {
    await q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,$3,$4,$5)`,
      [g, sede, dia, dia === 6 ? "09:00" : "07:00", dia === 6 ? "14:00" : "23:00"]);
  }

  // Segundo gimnasio demo, con otra marca: muestra que cada landing es propia.
  const [{ id: g2 }] = await q(`insert into public.gimnasios (slug, nombre, es_demo) values ('demo-box', 'Box Norte Demo', true) returning id`);
  await q(`update public.configuracion_gimnasio set color_acento = '#a78bfa', color_fondo = '#16121f' where gimnasio_id = $1`, [g2]);
  await q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [g2, `demo-box.${dominio}`]);
  await sembrarLanding(db, g2, {
    ...LANDING_DEMO,
    portada: { ...LANDING_DEMO.portada, titulo: "Funcional y boxeo en grupos chicos",
               bajada: "Clases de 50 minutos con cupo de 12 personas. Reservás desde el celular.", whatsapp: "+5490000333444" },
    secciones: { ...LANDING_DEMO.secciones, actividades: { items: [
      { emoji: "🥊", nombre: "Boxeo recreativo", descripcion: "Técnica, bolsa y guantes, sin contacto." },
      { emoji: "🔥", nombre: "Funcional", descripcion: "Fuerza y cardio en circuito." },
    ] } },
  });
  for (const [nombre, monto, desc] of [["Libre mensual", 32000, "Todas las clases que quieras."], ["8 clases por mes", 24000, "Dos por semana."]]) {
    const [{ id: p }] = await q(`insert into public.planes (gimnasio_id, tipo, nombre, descripcion, duracion_meses, renovacion)
                                 values ($1,'membresia',$2,$3,1,'continua') returning id`, [g2, nombre, desc]);
    await q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,$3,'2020-01-01')`, [g2, p, monto]);
  }

  const medianoche = async (dia) => (await q("select privado.medianoche($1::date, $2) as t", [dia, ZONA]))[0].t;
  const precio = Object.fromEntries(PLANES_TESTIGO.map((p) => [p.clave, p.precio]));
  const membresias = ["full", "full", "full", "manana", "tres"];

  let nIngresos = 0, nCoberturas = 0;
  for (let i = 1; i <= cantidad; i++) {
    const nombre = uno(NOMBRES), apellido = uno(APELLIDOS);
    const [{ id: s }] = await q(
      `insert into public.socios (gimnasio_id, nombre, apellido, telefono, email, fecha_nacimiento, creado_en)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [g, nombre, apellido, `+549000${String(2000000 + i)}`, `socio${i}@ejemplo.invalid`,
       `${entre(1965, 2006)}-${String(entre(1, 12)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}`,
       await medianoche(sumarDias(hoy, -entre(10, 700)))]);

    // Perfil: dónde termina su cobertura respecto de hoy.
    const r = azar();
    const fin = r < 0.55 ? entre(4, 30)      // al día
      : r < 0.65 ? entre(1, 3)               // por vencer
      : r < 0.73 ? entre(-4, 0)              // en tolerancia
      : r < 0.88 ? entre(-90, -6)            // vencido
      : null;                                // se fue (baja)
    const plan = uno(membresias);
    const meses = entre(2, 10);
    const finCobertura = fin ?? -entre(30, 120);
    const inicioDia = finCobertura - meses * 30;

    const [{ id: su }] = await q(
      `insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, baja_en, motivo_baja) values ($1,$2,$3,$4,$5,$6) returning id`,
      [g, s, planes[plan], await medianoche(sumarDias(hoy, inicioDia)),
       fin === null ? await medianoche(sumarDias(hoy, finCobertura + entre(1, 10))) : null,
       fin === null ? uno(["precio", "horario", "mudanza", "sin_tiempo"]) : null]);
    if (fin === null) {
      await q(`update public.socios set dado_de_baja_en = $2, motivo_baja = $3 where id = $1`,
        [s, await medianoche(sumarDias(hoy, finCobertura + 5)), uno(["precio", "horario", "mudanza", "sin_tiempo"])]);
    }

    // Coberturas mensuales contiguas, cada una con su venta y su pago.
    for (let m = 0; m < meses; m++) {
      const d = inicioDia + m * 30, h = m === meses - 1 ? finCobertura : d + 30;
      const desde = await medianoche(sumarDias(hoy, d)), hasta = await medianoche(sumarDias(hoy, h));
      const [{ id: v }] = await q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_en)
                                   values ($1,$2,$3,'confirmada','recepcion',$4,$4) returning id`, [g, sede, s, desde]);
      const [{ id: it }] = await q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, precio_unitario)
                                    values ($1,$2,'cuota',$3,$4,'Cuota mensual',$5) returning id`, [g, v, planes[plan], su, precio[plan]]);
      const medio = uno(["transferencia", "transferencia", "mercadopago", "debito"]);
      await q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, mp_pago_id, aprobado_en, creado_en)
               values ($1,$2,$3,$4,'aprobado',$5,$6,$6)`,
        [g, v, medio, precio[plan], medio === "mercadopago" ? `demo-${i}-${m}` : null, desde]);
      await q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id)
               values ($1,$2,$3,$4,$5,'pago',$6)`, [g, su, s, desde, hasta, it]);
      nCoberturas++;
    }

    // Ingresos de los últimos 90 días, solo en días cubiertos, en horarios pico.
    const porSemana = plan === "tres" ? entre(1, 3) : entre(1, 5);
    const dejoDeVenir = azar() < 0.15 ? entre(14, 30) : 0; // algunos al día que no vienen: retención
    const filas = [];
    for (let d = -90; d < 0; d++) {
      if (d >= finCobertura || d < inicioDia || d > -dejoDeVenir - 1) continue;
      if (azar() > porSemana / 7) continue;
      const hora = plan === "manana" ? entre(7, 11) : uno([7, 8, 9, 12, 13, 18, 18, 19, 19, 20, 21]);
      filas.push([sumarDias(hoy, d), `${hora}:${String(entre(0, 59)).padStart(2, "0")}`]);
    }
    if (filas.length) {
      const valores = filas.map((_, k) => `($1,$2,$3, privado.medianoche($${k * 2 + 4}::date, '${ZONA}') + $${k * 2 + 5}::interval,
        'recepcion','entro','membresia','verde','al_dia','Al día')`).join(",");
      await q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
               values ${valores}`, [g, sede, s, ...filas.flat()]);
      nIngresos += filas.length;
    }
  }

  // Prospectos: los que dejaron sus datos para probar (teléfonos 000, ficticios).
  const prospectos = [
    ["Valentina Ruiz", "+5490000200001", "Funcional a la mañana", "pagina", "nuevo", 0],
    ["Tomás Ibarra", "+5490000200002", "Musculación", "pagina", "nuevo", 1],
    ["Micaela Sosa", "+5490000200003", "Spinning", "recepcion", "contactado", 2],
    ["Joaquín Paz", "+5490000200004", null, "referido", "vino", 4],
    ["Florencia Díaz", "+5490000200005", "Pilates", "pagina", "no", 9],
  ];
  for (const [nombre, telefono, interes, origen, estado, dias] of prospectos) {
    await q(`insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, estado, creado_en, actualizado_en)
             values ($1,$2,$3,$4,$5,$6, now() - make_interval(days => $7), now() - make_interval(days => $7))`,
      [g, nombre, telefono, interes, origen, estado, dias]);
  }

  await db.query("commit");
  const [{ n }] = await q("select count(*)::int as n from public.socios where gimnasio_id = $1", [g]);
  console.log(`Gimnasio demo sembrado en ${((Date.now() - t0) / 1000).toFixed(1)} s (hoy = ${hoy}):`);
  console.log(`  ${n} socios (${Object.keys(testigos).length} testigos), ${nCoberturas} cuotas pagadas, ${nIngresos} ingresos`);
} catch (e) {
  await db.query("rollback");
  console.error("Falló la siembra, no quedó nada a medias:", e.message);
  process.exitCode = 1;
}
await db.end();
