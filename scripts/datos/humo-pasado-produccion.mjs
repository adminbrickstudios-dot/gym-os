// Prueba de humo contra la base de PRODUCCIÓN, en un gimnasio [demo] y dentro de una transacción que SIEMPRE revierte:
//   1) cargar un socio con fecha de alta y pago pasados (alta_socio_pasado) como el dueño del demo;
//   2) la caja de un turno por medio de pago (cobros_de_turnos): el pago pasado no la mueve y una venta por transferencia sí aparece.
// Nunca toca un gimnasio real: elige solo es_demo. Lo corre el workflow "Base de datos" → humo-pasado. No deja nada.
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("Falta SUPABASE_DB_URL"); process.exit(1); }
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, args) => (await db.query(sql, args)).rows;
let fallas = 0;
const paso = (ok, texto) => { console.log(`${ok ? "✓" : "✗"} ${texto}`); if (!ok) fallas++; };

try {
  await db.query("begin");
  const [g] = await q(`select g.id, g.zona_horaria from public.gimnasios g
                         join public.equipo e on e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and e.usuario_id is not null
                        where g.es_demo and g.baja_en is null order by g.creado_en limit 1`);
  if (!g) { console.log("No hay un gimnasio demo con dueño: nada que probar"); process.exitCode = 1; throw new Error("sin demo"); }
  const [dueno] = await q(`select e.id, e.usuario_id from public.equipo e where e.gimnasio_id = $1 and e.rol = 'dueno' and e.activo and e.usuario_id is not null limit 1`, [g.id]);
  const [sede] = await q(`select id from public.sedes where gimnasio_id = $1 order by creado_en limit 1`, [g.id]);
  const [plan] = await q(`select id, precio from public.planes where gimnasio_id = $1 and activo order by orden, nombre limit 1`, [g.id]);
  paso(!!(dueno && sede && plan), "el demo tiene dueño, sede y un plan activo");
  if (!(dueno && sede && plan)) throw new Error("faltan datos del demo");

  // Una caja y un turno abiertos dentro de la transacción (se revierten).
  const [caja] = await q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Humo') returning id`, [g.id, sede.id]);
  const [turno] = await q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial) values ($1,$2,$3, now(), 0) returning id`, [g.id, caja.id, dueno.id]);
  const medios = async () => (await q(`select public.cobros_de_turnos(array[$1]::uuid[]) as r`, [turno.id]))[0].r;
  const antes = JSON.stringify(await medios());

  const [{ d20 }] = await q(`select (privado.dia_local(now(), $1) - 20)::text as d20`, [g.zona_horaria]);
  const como = async (fn) => {
    await db.query("set local role authenticated");
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: dueno.usuario_id, role: "authenticated" })]);
    try { return await fn(); } finally { await db.query("reset role"); }
  };
  const dni = String(90000000 + Math.floor(Math.random() * 9999999));
  const r = await como(async () => (await q(`select public.alta_socio_pasado($1, $2, $3::jsonb, $4, $5::date, $6::jsonb) as r`,
    [g.id, sede.id, JSON.stringify({ nombre: "Humo", apellido: "Pasado", dni }), plan.id, d20, JSON.stringify([{ fecha: d20, monto: String(plan.precio ?? 10000), medio: "transferencia" }])]))[0].r);
  paso(r && Number(r.pagos) === 1 && Number(r.coberturas) >= 1, `alta con fecha y pago de hace 20 días: ${r?.pagos} pago, ${r?.coberturas} cobertura`);
  const [s] = await q(`select s.id, s.creado_en::date as alta, s.cubierto_hasta from public.socios s where s.gimnasio_id = $1 and s.dni = $2`, [g.id, dni]);
  paso(!!s, "el socio quedó cargado");
  paso(JSON.stringify(await medios()) === antes, "la caja del turno por medio de pago no cambió");

  // Una venta de hoy por transferencia y otra en efectivo sí aparecen, cada una en su medio.
  const [prod] = await q(`insert into public.productos (gimnasio_id, nombre, precio) values ($1,'Humo',1000) returning id`, [g.id]);
  const item = JSON.stringify([{ tipo: "producto", producto_id: prod.id, cantidad: 1 }]);
  await q(`select privado.vender($1,$2,null,$3::jsonb,$4::jsonb,$5,$6,null, now())`, [g.id, sede.id, item, JSON.stringify([{ medio: "efectivo", monto: 1000 }]), turno.id, dueno.id]);
  await q(`select privado.vender($1,$2,null,$3::jsonb,$4::jsonb,$5,$6,null, now())`, [g.id, sede.id, item, JSON.stringify([{ medio: "transferencia", monto: 1000 }]), turno.id, dueno.id]);
  const txt = JSON.stringify(await medios());
  paso(txt.includes("transferencia") && txt.includes("efectivo"), "la caja del turno muestra efectivo y transferencia por separado");
} catch (e) {
  if (e.message !== "sin demo") { console.log(`✗ ERROR: ${e.message}`); fallas++; }
} finally {
  await db.query("rollback").catch(() => {});
  const [{ n }] = await q(`select count(*)::int n from public.socios where nombre = 'Humo' and apellido = 'Pasado'`);
  paso(n === 0, "todo se revirtió: no quedó ningún socio de prueba");
  await db.end();
}
if (fallas) { console.log(`Humo pasado: ${fallas} falla(s)`); process.exit(1); }
console.log("Humo pasado: todo en verde");
