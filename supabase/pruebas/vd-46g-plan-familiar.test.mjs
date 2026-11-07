// VD-46G (20261106007700): plan familiar y corporativo. El titular paga y los vinculados heredan la cobertura:
// "Cubierto por X"; si el titular vence o se da de baja, cada miembro ve el motivo; los cobros van al titular sin duplicados.
// Arranca apagado (apagado = comportamiento de antes) y solo el dueño lo prende; dueño y encargado arman grupos con titular.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { CASOS_FAMILIA, sembrarFamilia } from "../../scripts/datos/casos-testigo.mjs";

let t, momento, fam, u = {}, ajeno;
const acceso = async (socio) => (await t.q(`select (privado.calcular_acceso($1, $2, $3)).*`, [socio, momento, t.sede]))[0];
const retencion = async () => t.q(`select * from privado.retencion($1, $2)`, [t.g, momento]);

before(async () => {
  t = await abrir("prueba-vd46g");
  momento = await t.en(HOY);
  for (const [rol, nombre] of [["dueno", "Sofía"], ["encargado", "Martín"], ["recepcion", "Ana"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, nombre, rol]);
    u[rol] = id;
  }
  [{ id: ajeno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`ajeno${Math.random()}@ejemplo.invalid`]);
  fam = await sembrarFamilia(t.db, { gimnasioId: t.g, socios: t.ctx.socios, activar: false });
});
after(async () => t && t.cerrar());

async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}

test("apagado (como arranca): los vinculados no heredan nada, igual que antes", async () => {
  const [{ plan_familiar_activo }] = await t.q(`select plan_familiar_activo from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]);
  assert.equal(plan_familiar_activo, false);
  for (const c of CASOS_FAMILIA) {
    const v = await acceso(fam.socios[c.clave]);
    assert.equal(v.motivo, "sin_plan", c.clave);
    assert.equal(v.puede, false, c.clave);
  }
  // el titular, solo, es el mismo de siempre
  assert.equal((await acceso(t.ctx.socios.al_dia)).motivo, "al_dia");
});

test("solo el dueño prende el plan familiar; el resto, ni siquiera lo cambia", async () => {
  await como(u.encargado, async () => {
    await t.falla(() => t.q(`select public.guardar_plan_familiar($1, true)`, [t.g]), /Sin permiso/);
    assert.equal((await t.q(`select public.plan_familiar_estado($1) as e`, [t.g]))[0].e, false);
  });
  await como(u.recepcion, () => t.falla(() => t.q(`select public.plan_familiar_estado($1)`, [t.g]), /Sin permiso/));
  await como(ajeno, () => t.falla(() => t.q(`select public.guardar_plan_familiar($1, true)`, [t.g]), /Sin permiso/));
  // apagado no se arma: ni titular
  await como(u.dueno, () => t.falla(() => t.q(`select public.fijar_titular_familia($1, $2)`, [t.ctx.socios.al_dia, t.ctx.socios.al_dia]), /Prendé primero/));
  await como(u.dueno, () => t.q(`select public.guardar_plan_familiar($1, true)`, [t.g]));
  assert.equal((await t.q(`select plan_familiar_activo as a from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g]))[0].a, true);
  await como(u.encargado, async () => assert.equal((await t.q(`select public.plan_familiar_estado($1) as e`, [t.g]))[0].e, true));
});

test("casos testigo: titular al día, vencido y dado de baja", async () => {
  for (const c of CASOS_FAMILIA) {
    const v = await acceso(fam.socios[c.clave]);
    const e = c.esperado;
    assert.equal(v.puede, e.puede, `${c.clave}: ${v.texto}`);
    assert.equal(v.color, e.color, `${c.clave}: ${v.texto}`);
    assert.equal(v.motivo, e.motivo, `${c.clave}: ${v.texto}`);
    if (e.via) assert.equal(v.via, e.via, c.clave);
    if (e.consume) assert.equal(v.consume, e.consume, c.clave);
    assert.match(v.texto, e.texto, c.clave);
  }
  assert.match((await acceso(fam.socios.vinculado_titular_vencido)).texto, /^El plan corporativo de Testigo Vencida venció el 24\/10$/);
  // el titular no cambia: sigue siendo quien es
  assert.equal((await acceso(t.ctx.socios.al_dia)).motivo, "al_dia");
  assert.equal((await acceso(t.ctx.socios.vencida)).motivo, "vencida");
  assert.equal((await acceso(t.ctx.socios.se_fue)).motivo, "se_fue");
});

test("titular en tolerancia o por vencer: el miembro entra con el mismo color y el aviso al titular", async () => {
  const [{ id: gr }] = await t.q(`insert into public.grupos_familiares (gimnasio_id) values ($1) returning id`, [t.g]);
  const [{ id: m }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, grupo_familiar_id) values ($1,'Pía','Toler','+5490000999010',$2) returning id`, [t.g, gr]);
  await t.q(`update public.socios set grupo_familiar_id = $2 where id = $1`, [t.ctx.socios.en_tolerancia, gr]);
  await t.q(`update public.grupos_familiares set titular_id = $2 where id = $1`, [gr, t.ctx.socios.en_tolerancia]);
  const v = await acceso(m);
  assert.equal(v.puede, true); assert.equal(v.color, "naranja"); assert.equal(v.motivo, "cubierto_por_titular");
  assert.match(v.texto, /^Cubierto por Testigo En Tolerancia · Venció el /);
  // por vencer
  await t.q(`update public.socios set grupo_familiar_id = null where id = $1`, [t.ctx.socios.en_tolerancia]);
  await t.q(`update public.socios set grupo_familiar_id = $2 where id = $1`, [t.ctx.socios.por_vencer, gr]);
  await t.q(`update public.grupos_familiares set titular_id = $2 where id = $1`, [gr, t.ctx.socios.por_vencer]);
  const w = await acceso(m);
  assert.equal(w.color, "amarillo"); assert.match(w.texto, /avisale a Testigo Por Vencer$/);
});

test("quien tiene cobertura propia entra con la propia, aunque el titular esté vencido", async () => {
  const gr = fam.grupos.vinculado_titular_vencido;
  await t.q(`update public.socios set grupo_familiar_id = $2 where id = $1`, [t.ctx.socios.pase_hoy, gr]);
  const v = await acceso(t.ctx.socios.pase_hoy);
  assert.equal(v.puede, true); assert.equal(v.via, "pase"); assert.equal(v.motivo, "pase_de_hoy");
  await t.q(`update public.socios set grupo_familiar_id = null where id = $1`, [t.ctx.socios.pase_hoy]);
});

test("una suspensión del miembro lo alcanza; la del titular no", async () => {
  const miembro = fam.socios.vinculado_al_dia, desde = await t.en("2026-11-13");
  await t.db.query("savepoint susp");
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo) values ($1,$2,$3,'Pelea en el vestuario')`, [t.g, miembro, desde]);
  assert.equal((await acceso(miembro)).motivo, "suspendido");
  await t.db.query("rollback to savepoint susp");
  await t.q(`insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo) values ($1,$2,$3,'Pelea en el vestuario')`, [t.g, t.ctx.socios.al_dia, desde]);
  assert.equal((await acceso(t.ctx.socios.al_dia)).motivo, "suspendido");
  const v = await acceso(miembro);
  assert.equal(v.motivo, "cubierto_por_titular", "la suspensión del titular es de la persona, no del plan");
  await t.db.query("rollback to savepoint susp");
});

test("los cobros van al titular y a nadie más: sin duplicados", async () => {
  // un vinculado con membresía propia por vencer: antes salía en la lista, ahora lo cobra el titular
  const gr = fam.grupos.vinculado_titular_vencido;
  await t.q(`update public.socios set grupo_familiar_id = $2 where id = $1`, [t.ctx.socios.vence_hoy, gr]);
  const filas = await retencion();
  const tit = filas.find((f) => f.socio_id === t.ctx.socios.vencida);
  assert.equal(tit.lista, "vencido");
  assert.match(tit.texto, /^Venció el 24\/10 · debe \$25\.000 · paga por 2 vinculados$/);
  assert.equal(filas.filter((f) => f.socio_id === t.ctx.socios.vence_hoy).length, 0, "el vinculado no se cobra aparte");
  assert.equal(filas.filter((f) => f.socio_id === fam.socios.vinculado_titular_vencido).length, 0);
  // y Vencen hoy / Para hacer hoy salen de la misma lista
  await como(u.dueno, async () => {
    const r = (await t.q(`select public.vencen_pestanas($1) as r`, [t.g]))[0].r;
    const ids = [...r.hoy.filas, ...r.vencidos.filas, ...r.por_vencer.filas].map((f) => f.socio_id);
    assert.ok(ids.includes(t.ctx.socios.vencida) && !ids.includes(t.ctx.socios.vence_hoy));
  });
  // apagado: vuelve a salir cada uno por su lado
  await como(u.dueno, () => t.q(`select public.guardar_plan_familiar($1, false)`, [t.g]));
  const antes = await retencion();
  assert.equal(antes.filter((f) => f.socio_id === t.ctx.socios.vence_hoy).length, 1);
  assert.equal(antes.find((f) => f.socio_id === t.ctx.socios.vencida).texto, "Venció el 24/10 · debe $25.000");
  assert.equal((await acceso(fam.socios.vinculado_al_dia)).motivo, "sin_plan", "apagado: no hereda");
  await como(u.dueno, () => t.q(`select public.guardar_plan_familiar($1, true)`, [t.g]));
  await t.q(`update public.socios set grupo_familiar_id = null where id = $1`, [t.ctx.socios.vence_hoy]);
});

test("permisos: titular solo dueño o encargado; un grupo con titular no lo toca la recepción", async () => {
  const miembro = fam.socios.vinculado_al_dia, titular = t.ctx.socios.al_dia;
  await como(u.recepcion, async () => {
    await t.falla(() => t.q(`select public.fijar_titular_familia($1, $2)`, [miembro, miembro]), /Sin permiso/);
    await t.falla(() => t.q(`select public.quitar_titular_familia($1)`, [miembro]), /Sin permiso/);
    await t.falla(() => t.q(`select public.sacar_de_familia($1)`, [miembro]), /Sin permiso/);
    await t.falla(() => t.q(`select public.vincular_familia($1, $2)`, [miembro, t.ctx.socios.sin_plan]), /Sin permiso/);
    // ver sí puede
    const f = (await t.q(`select public.familia_socio($1) as f`, [miembro]))[0].f;
    assert.equal(f.length, 1); assert.equal(f[0].es_titular, true);
    const p = (await t.q(`select public.plan_familiar_socio($1) as p`, [miembro]))[0].p;
    assert.equal(p.titular_id, titular); assert.equal(p.es_titular, false); assert.equal(p.activo, true);
  });
  await como(ajeno, () => t.falla(() => t.q(`select public.plan_familiar_socio($1)`, [miembro]), /Sin permiso/));
  // la recepción sí vincula a quien todavía no tiene grupo con titular
  const a = t.ctx.socios.sin_plan, b = t.ctx.socios.pack_agotado;
  await como(u.recepcion, () => t.q(`select public.vincular_familia($1, $2)`, [a, b]));
  // y no puede ser titular quien no es del grupo, ni quien se fue
  await como(u.encargado, async () => {
    await t.falla(() => t.q(`select public.fijar_titular_familia($1, $2)`, [a, titular]), /mismo grupo/);
    await t.falla(() => t.q(`select public.fijar_titular_familia($1, $2, 'otro')`, [a, a]), /familiar o corporativo/);
    await t.q(`select public.fijar_titular_familia($1, $2, 'corporativo')`, [a, b]);
    assert.equal((await t.q(`select public.plan_familiar_socio($1) as p`, [a]))[0].p.tipo, "corporativo");
    // dar de baja al que sería titular: no se puede elegir
    await t.falla(() => t.q(`select public.fijar_titular_familia($1, $2)`, [fam.socios.vinculado_titular_de_baja, t.ctx.socios.se_fue]), /dada de baja/);
    await t.q(`select public.quitar_titular_familia($1)`, [a]);
    await t.falla(() => t.q(`select public.quitar_titular_familia($1)`, [a]), /no tiene titular/);
    // sacar al titular de su grupo lo deja sin titular
    await t.q(`select public.sacar_de_familia($1)`, [titular]);
  });
  assert.equal((await t.q(`select titular_id from public.grupos_familiares where id = $1`, [fam.grupos.vinculado_al_dia]))[0].titular_id, null);
  assert.equal((await acceso(miembro)).motivo, "sin_plan", "sin titular, sin herencia");
});

test("un gimnasio no ve ni toca el grupo de otro", async () => {
  const [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-vd46g-b', 'Otro') returning id`);
  const [{ id: duenoB }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`dueno-b${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Otra','dueno')`, [g2, duenoB]);
  await como(duenoB, async () => {
    await t.falla(() => t.q(`select public.guardar_plan_familiar($1, true)`, [t.g]), /Sin permiso/);
    await t.falla(() => t.q(`select public.fijar_titular_familia($1, $2)`, [fam.socios.vinculado_al_dia, fam.socios.vinculado_al_dia]), /Sin permiso|no existe|No es/);
  });
});
