#!/usr/bin/env node
// Siembra el gimnasio demo: datos OBVIAMENTE ficticios, para probar con
// volumen real, para las capturas y para mostrarle el sistema a un prospecto.
//
//   node scripts/datos/sembrar-demo.mjs --url postgres://... [--socios 300] [--hoy 2026-11-14]
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

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env.local"))) process.loadEnvFile(join(raiz, ".env.local"));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg("url", process.env.DB_PRUEBAS_URL || process.env.SUPABASE_DB_URL);
const cantidad = Number(arg("socios", "300"));
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
  await q(`update public.configuracion_gimnasio set cobra_pack = true, accesos_activos = array['recepcion','qr_socio','kiosco'],
             alias_transferencia = 'GIMNASIO.DEMO.EJEMPLO', titular_cuenta = 'Gimnasio Demo (ficticio)' where gimnasio_id = $1`, [g]);
  await q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, 'demo.localhost', 'subdominio')`, [g]);

  const { planes, socios: testigos } = await sembrarCasos(db, { gimnasioId: g, sedeId: sede, hoy, telefonoBase: 5490000100000 });

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
       `${entre(1965, 2008)}-${String(entre(1, 12)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}`,
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
      const [{ id: it }] = await q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, precio_unitario)
                                    values ($1,$2,'cuota',$3,'Cuota mensual',$4) returning id`, [g, v, planes[plan], precio[plan]]);
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
