// VD-37 · Los números del menú (pendientes_panel) y la campana con preferencias.
// Cada contador sale de los hechos y BAJA SOLO cuando el hecho se resuelve (nada se marca a mano); cada rol
// ve solo sus contadores (el que no es del equipo recibe un error, no un vacío); las preferencias apagan
// tipos de la campana de esa persona y de nadie más.
// Los datos son fijos y propios de la prueba; los contadores se comparan antes/después (la base de prueba
// tiene otros testigos que también cuentan).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, eq = {}, socio, caja1, caja2;
async function persona(rol, nombre) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id: e }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
  u[rol + nombre] = id; eq[rol + nombre] = e;
  return id;
}
before(async () => {
  t = await abrir("prueba-pendientes");
  u.dueno = await persona("dueno", "Sofía");
  u.encargado = await persona("encargado", "Elena");
  u.recepcion = await persona("recepcion", "Ana");
  u.recepcion2 = await persona("recepcion", "Beto");
  u.profe = await persona("profe", "Diego");
  const [{ id: forastero }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`forastero${Math.random()}@ejemplo.invalid`]);
  u.forastero = forastero;
  const [{ id: us }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  u.socio = us;
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, usuario_id) values ($1,'Lucía','Pendientes',$2) returning id`, [t.g, us]);
  [{ id: caja1 }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
  [{ id: caja2 }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Barra') returning id`, [t.g, t.sede]);
});
after(async () => t && t.cerrar());
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const pend = (usuario) => como(usuario, async () => (await t.q(`select public.pendientes_panel($1) as p`, [t.g]))[0].p);
const campana = (usuario) => como(usuario, async () => (await t.q(`select public.campana_panel($1) as c`, [t.g]))[0].c);
const nuevoPago = async () => {
  const [{ id: venta }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen) values ($1,$2,$3,'app') returning id`, [t.g, t.sede, socio]);
  const [{ id }] = await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path) values ($1,$2,'transferencia',15000,'pendiente','x/p.jpg') returning id`, [t.g, venta]);
  return id;
};

test("permisos: quien no es del equipo recibe un error (no un vacío); anon no puede ejecutarla", async () => {
  for (const quien of ["forastero", "socio"]) {
    await como(u[quien], () => t.falla(() => t.q(`select public.pendientes_panel($1)`, [t.g]), /Sin permiso/));
    await como(u[quien], () => t.falla(() => t.q(`select public.campana_panel($1)`, [t.g]), /Sin permiso/));
    await como(u[quien], () => t.falla(() => t.q(`select public.preferencias_aviso_panel($1)`, [t.g]), /Sin permiso/));
  }
  await t.db.query("set role anon");
  try { await t.falla(() => t.q(`select public.pendientes_panel($1)`, [t.g]), /permission denied|permiso/i); } finally { await t.db.query("reset role"); }
});

test("cada rol ve solo sus contadores: el profe solo lo suyo; la recepción no ve los de gestión; el mensajes de VD-38 queda en 0", async () => {
  const profe = await pend(u.profe);
  assert.deepEqual(Object.keys(profe).sort(), ["tareas"]);
  const rec = await pend(u.recepcion);
  assert.deepEqual(Object.keys(rec).sort(), ["caja", "mensajes", "prospectos", "tareas", "transferencias", "vencen_hoy"]);
  assert.equal(rec.mensajes, 0, "VD-38 todavía no existe");
  const dueno = await pend(u.dueno);
  assert.deepEqual(Object.keys(dueno).sort(), ["caja", "control", "mensajes", "prospectos", "socios", "tareas", "transferencias", "vencen_hoy"]);
  // El encargado sin acceso al Resultado no tiene "control" (ni error).
  await t.q(`update public.configuracion_gimnasio set encargado_ve_resultado = false where gimnasio_id = $1`, [t.g]);
  assert.ok(!("control" in (await pend(u.encargado))), "sin Resultado no hay Control");
  await t.q(`update public.configuracion_gimnasio set encargado_ve_resultado = true where gimnasio_id = $1`, [t.g]);
  assert.ok("control" in (await pend(u.encargado)));
  for (const v of Object.values(dueno)) assert.ok(Number.isInteger(v) && v >= 0);
});

test("Transferencias: sube con un comprobante y baja sola al resolverlo (aprobar o rechazar)", async () => {
  const antes = (await pend(u.recepcion)).transferencias;
  const pago = await nuevoPago();
  assert.equal((await pend(u.recepcion)).transferencias, antes + 1);
  assert.equal((await pend(u.dueno)).transferencias, antes + 1);
  await como(u.dueno, () => t.q(`select public.rechazar_pago($1, 'No se ve el monto')`, [pago]));
  assert.equal((await pend(u.recepcion)).transferencias, antes, "al rechazarlo baja solo");
});

test("Interesados: sube con uno nuevo y baja cuando se lo contacta", async () => {
  const antes = (await pend(u.recepcion)).prospectos;
  const tel = `387 55${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const id = await como(u.recepcion, async () => (await t.q(`select public.crear_prospecto($1, 'Interesada Fija', $2) as id`, [t.g, tel]))[0].id);
  assert.equal((await pend(u.recepcion)).prospectos, antes + 1);
  assert.equal((await pend(u.profe)).prospectos, undefined, "el profe no ve interesados");
  await como(u.recepcion, () => t.q(`select public.actualizar_prospecto($1, $2, 'contactado')`, [t.g, id]));
  assert.equal((await pend(u.recepcion)).prospectos, antes, "contactado ya no es nuevo");
});

test("Para hacer hoy: es el de la base (se la llama, no se copia) más mis tareas; baja al marcarla hecha", async () => {
  const hechas = await como(u.recepcion, async () => (await t.q(`select jsonb_array_length(public.para_hacer_hoy($1)) as n`, [t.g]))[0].n);
  const mia = (await pend(u.recepcion)).tareas;
  assert.equal(mia, hechas, "sin tareas propias es exactamente lo de para_hacer_hoy");
  const [{ hoy }] = await t.q(`select (now() at time zone zona_horaria)::date as hoy from public.gimnasios where id = $1`, [t.g]);
  const profeAntes = (await pend(u.profe)).tareas;
  const tarea = await como(u.dueno, async () => (await t.q(`select public.crear_tarea($1, 'Regar las plantas', $2, $3) as id`, [t.g, eq.profeDiego, hoy]))[0].id);
  assert.equal((await pend(u.profe)).tareas, profeAntes + 1);
  assert.equal((await pend(u.recepcion)).tareas, mia, "la tarea es del profe: la recepción no la cuenta");
  await como(u.profe, () => t.q(`select public.marcar_tarea($1, true)`, [tarea]));
  assert.equal((await pend(u.profe)).tareas, profeAntes);
});

test("Caja: una abierta que quedó del día anterior cuenta para su dueña y para la gestión, no para otra recepción; al cerrarla baja", async () => {
  const antes = { ana: (await pend(u.recepcion)).caja, beto: (await pend(u.recepcion2)).caja, dueno: (await pend(u.dueno)).caja };
  const turno = await como(u.recepcion, async () => (await t.q(`select public.abrir_caja($1, 1000) as id`, [caja1]))[0].id);
  assert.equal((await pend(u.recepcion)).caja, antes.ana, "recién abierta no es un pendiente");
  await t.q(`update public.turnos_caja set abierto_en = now() - interval '2 days' where id = $1`, [turno]);
  const despues = { ana: (await pend(u.recepcion)).caja, beto: (await pend(u.recepcion2)).caja, dueno: (await pend(u.dueno)).caja };
  assert.equal(despues.beto, antes.beto, "otra recepción no cuenta la caja ajena");
  assert.equal(despues.ana, antes.ana + 1, "su dueña la cuenta");
  assert.equal(despues.dueno, antes.dueno + 1, "la gestión también");
  // La primera vez que alguien la mira queda registrada como "sin contar" (VD-9): para la recepción deja de estar
  // olvidada (ya está cerrada) y para la gestión pasa a ser una caja para contar. Al contarla, el pendiente desaparece.
  await como(u.dueno, () => t.q(`select public.cajas_para_revisar($1)`, [t.g]));
  assert.equal((await pend(u.recepcion)).caja, antes.ana, "la recepción no tiene que contarla");
  assert.equal((await pend(u.dueno)).caja, antes.dueno + 1, "para el dueño sigue siendo un pendiente: sin contar");
  await como(u.dueno, () => t.q(`select public.contar_caja_sin_contar($1, 1000)`, [turno]));
  assert.equal((await pend(u.dueno)).caja, antes.dueno, "contada, baja sola");
});

test("Vencen y cobrar: sube con uno que vence hoy y baja solo cuando paga", async () => {
  const hoy0 = (await pend(u.recepcion)).vencen_hoy;
  const s = t.ctx.socios.vence_hoy;
  // El testigo vence "hoy" del calendario de la prueba; se le suma una cortesía que termina al fin del día real de la base.
  await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
              select c.gimnasio_id, c.suscripcion_id, c.socio_id, max(c.hasta), privado.medianoche(privado.dia_local(now(), g.zona_horaria)::date + 1, g.zona_horaria), 'cortesia', 'prueba de pendientes'
                from public.coberturas c join public.gimnasios g on g.id = c.gimnasio_id
               where c.socio_id = $1 and c.anulada_en is null group by c.gimnasio_id, c.suscripcion_id, c.socio_id, g.zona_horaria`, [s]);
  const conUno = (await pend(u.recepcion)).vencen_hoy;
  assert.equal(conUno, hoy0 + 1, "el que vence hoy suma");
  assert.equal((await pend(u.dueno)).vencen_hoy, conUno);
  const turno = await como(u.dueno, async () => (await t.q(`select public.abrir_caja($1, 0) as id`, [caja2]))[0].id);
  await como(u.dueno, () => t.q(`select public.vender($1, $2, $3, $4, $5)`, [
    t.sede, JSON.stringify([{ tipo: "cuota" }]), JSON.stringify([{ medio: "efectivo", monto: 25000 }]), s, turno]));
  assert.equal((await pend(u.recepcion)).vencen_hoy, hoy0, "al cobrarle baja solo");
});

test("preferencias: cada rol elige solo sus tipos; apagar uno saca esos avisos de MI campana y de la de nadie más", async () => {
  const pago = await nuevoPago();
  const clave = `pago:${pago}`;
  const lista = await como(u.recepcion, async () => (await t.q(`select public.preferencias_aviso_panel($1) as p`, [t.g]))[0].p);
  assert.deepEqual(lista.map((x) => x.tipo), ["comprobantes", "caja", "pedidos"]);
  assert.ok(lista.every((x) => x.app === true), "por defecto todo prendido");
  const c1 = await campana(u.recepcion);
  const aviso = c1.items.find((i) => i.clave === clave);
  assert.ok(aviso, "está en la campana"); assert.equal(aviso.tipo, "comprobantes");
  await como(u.recepcion, () => t.q(`select public.guardar_preferencia_aviso($1, 'comprobantes', 'app', false)`, [t.g]));
  assert.ok(!(await campana(u.recepcion)).items.some((i) => i.clave === clave), "apagado: ya no aparece");
  assert.ok((await campana(u.recepcion2)).items.some((i) => i.clave === clave), "la otra recepción lo sigue viendo");
  assert.ok((await campana(u.dueno)).items.some((i) => i.clave === clave), "el dueño también");
  assert.equal((await pend(u.recepcion)).transferencias >= 1, true, "el contador del menú no se apaga: es trabajo, no aviso");
  await como(u.recepcion, () => t.q(`select public.guardar_preferencia_aviso($1, 'comprobantes', 'app', true)`, [t.g]));
  assert.ok((await campana(u.recepcion)).items.some((i) => i.clave === clave), "prendido otra vez");
  const [{ n }] = await t.q(`select count(*)::int as n from public.preferencias_aviso where gimnasio_id = $1 and tipo = 'comprobantes'`, [t.g]);
  assert.equal(n, 1, "una sola fila por usuario, tipo y canal");
});

test("preferencias: un tipo que no es de mi rol y un canal que no existe dan error, y nadie lee las de otro", async () => {
  await como(u.profe, () => t.falla(() => t.q(`select public.guardar_preferencia_aviso($1, 'comprobantes', 'app', false)`, [t.g]), /no es de tu rol/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_preferencia_aviso($1, 'control', 'app', false)`, [t.g]), /no es de tu rol/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.guardar_preferencia_aviso($1, 'comprobantes', 'push', false)`, [t.g]), /canal/));
  await como(u.forastero, () => t.falla(() => t.q(`select public.guardar_preferencia_aviso($1, 'comprobantes', 'app', false)`, [t.g]), /Sin permiso/));
  await como(u.recepcion, () => t.q(`select public.guardar_preferencia_aviso($1, 'caja', 'app', false)`, [t.g]));
  const vistas = await como(u.recepcion2, async () => (await t.q(`select count(*)::int as n from public.preferencias_aviso`))[0].n);
  assert.equal(vistas, 0, "RLS: Beto no lee las de Ana");
  const desde = await como(u.recepcion, async () => (await t.q(`select public.preferencias_aviso_panel($1) as p`, [t.g]))[0].p);
  assert.equal(desde.find((x) => x.tipo === "caja").app, false);
});
