// VD-9 · La caja por turno se cierra sola (D20), sin cron: una caja abierta de un día anterior
// ES una caja sin contar al primer acceso; nadie cobra en ella; el dueño la cuenta después;
// reporte X y Z con SOBRA/FALTA; modo "una caja por día"; billetes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uRec, uRec2, uEnc, uDueno, caja1, caja2, turnoViejo;
before(async () => {
  t = await abrir("prueba-caja-sin-contar");
  [{ id: caja1 }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Mostrador') returning id`, [t.g, t.sede]);
  [{ id: caja2 }] = await t.q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Barra') returning id`, [t.g, t.sede]);
  const crear = async (rol, n) => {
    const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, n, rol]);
    return u;
  };
  uRec = await crear("recepcion", "Ana"); uRec2 = await crear("recepcion", "Beto"); uEnc = await crear("encargado", "Elena"); uDueno = await crear("dueno", "Sofía");
});
after(async () => t && t.cerrar());
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const cuota = (turno, socio = t.ctx.socios.sin_pago) => t.q(`select public.vender($1, $2, $3, $4, $5) as r`, [
  t.sede, JSON.stringify([{ tipo: "cuota" }]), JSON.stringify([{ medio: "efectivo", monto: 25000 }]), socio, turno]);
const resumen = async (turno) => (await t.q(`select privado.resumen_turno($1) as r`, [turno]))[0].r;

test("caja abierta ayer: hoy figura sin contar, con el esperado calculado", async () => {
  turnoViejo = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 1000) as id`, [caja1]))[0].id);
  await como(uRec, () => cuota(turnoViejo));
  assert.equal((await resumen(turnoViejo)).estado, "abierto");
  await t.q(`update public.turnos_caja set abierto_en = now() - interval '1 day' where id = $1`, [turnoViejo]);
  const r = await resumen(turnoViejo);
  assert.equal(r.estado, "sin_contar");
  assert.equal(Number(r.esperado), 26000);
  const [{ v }] = await t.q(`select privado.turno_vence($1) as v`, [turnoViejo]);
  assert.ok(new Date(v) <= new Date(), "se vence a la hora de corte, no depende de un cron");
  const [c] = await como(uRec, async () => t.q(`select * from public.cajas_sede($1) where caja_id = $2`, [t.sede, caja1]));
  assert.equal(c.vencida, true);
  const mi = await como(uRec, async () => (await t.q(`select public.mi_turno_caja($1) as m`, [t.sede]))[0].m);
  assert.equal(mi.turno.vencido, true);
});

test("nadie puede cobrar ni anotar plata en ella (ni siquiera con el id del turno a mano)", async () => {
  await como(uRec, () => t.falla(() => cuota(turnoViejo), /sin contar: nadie puede cobrar/));
  await como(uRec, () => t.falla(() => cuota(turnoViejo, t.ctx.socios.vencida), /sin contar: nadie puede cobrar/));
  await como(uEnc, () => t.falla(() => t.q(`select public.movimiento_caja($1, 'retiro', 100, 'Limpieza')`, [turnoViejo]), /sin contar: nadie puede cobrar/));
  assert.equal((await resumen(turnoViejo)).estado, "sin_contar", "el rechazo no cambió nada");
});

test("el dueño la ve en Para revisar (queda registrada, sin responsable del conteo); la recepción no", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.cajas_para_revisar($1)`, [t.g]), /Sin permiso/));
  const l = await como(uDueno, async () => (await t.q(`select public.cajas_para_revisar($1) as l`, [t.g]))[0].l);
  assert.equal(l.length, 1);
  assert.equal(l[0].caja, "Mostrador"); assert.equal(l[0].abierto_por, "Ana"); assert.equal(Number(l[0].esperado), 26000); assert.equal(l[0].estado, "sin_contar");
  const [f] = await t.q(`select cerrado_en, cerrado_por, monto_contado, sin_contar, sin_contar_en, monto_esperado from public.turnos_caja where id = $1`, [turnoViejo]);
  assert.ok(f.cerrado_en && f.sin_contar && f.sin_contar_en);
  assert.equal(f.cerrado_por, null); assert.equal(f.monto_contado, null); assert.equal(Number(f.monto_esperado), 26000);
  // Repetir no cambia nada (idempotente).
  const l2 = await como(uEnc, async () => (await t.q(`select public.cajas_para_revisar($1) as l`, [t.g]))[0].l);
  assert.equal(l2.length, 1);
});

test("quien la abrió no puede 'cerrarla' ya registrada; abre su turno nuevo sin trabas", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.cerrar_caja($1, 26000)`, [turnoViejo]), /se cerró sola/));
  const nuevo = await como(uRec, async () => (await t.q(`select public.abrir_caja($1, 500) as id`, [caja1]))[0].id);
  assert.equal((await resumen(nuevo)).estado, "abierto");
  await como(uRec, () => cuota(nuevo));
  await como(uRec, () => t.q(`select public.cerrar_caja($1, 25000, 'Faltan 500')`, [nuevo]));
});

test("el dueño la cuenta después: ahí sale la diferencia; solo una vez; la recepción no puede", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.contar_caja_sin_contar($1, 26000)`, [turnoViejo]), /Sin permiso/));
  await como(uDueno, () => t.falla(() => t.q(`select public.contar_caja_sin_contar($1, -5)`, [turnoViejo]), /negativo/));
  const r = await como(uDueno, async () => (await t.q(`select public.contar_caja_sin_contar($1, 25000, 'Faltaba un retiro') as r`, [turnoViejo]))[0].r);
  assert.equal(r.estado, "contada_despues"); assert.equal(Number(r.diferencia), -1000); assert.equal(Number(r.contado), 25000);
  const [f] = await t.q(`select cerrado_por, revisado_por, revisado_en, contado_en from public.turnos_caja where id = $1`, [turnoViejo]);
  assert.ok(f.cerrado_por && f.revisado_por && f.revisado_en && f.contado_en, "queda quién y cuándo");
  await como(uDueno, () => t.falla(() => t.q(`select public.contar_caja_sin_contar($1, 26000)`, [turnoViejo]), /ya se revisó/));
  const l = await como(uDueno, async () => (await t.q(`select public.cajas_para_revisar($1) as l`, [t.g]))[0].l);
  assert.equal(l.length, 0, "contada, sale de Para revisar");
});

test("dejarla sin contar pide motivo y queda escrito", async () => {
  const tv = await como(uRec2, async () => (await t.q(`select public.abrir_caja($1, 200) as id`, [caja2]))[0].id);
  await t.q(`update public.turnos_caja set abierto_en = now() - interval '2 days' where id = $1`, [tv]);
  const l = await como(uEnc, async () => (await t.q(`select public.cajas_para_revisar($1) as l`, [t.g]))[0].l);
  assert.equal(l.length, 1);
  await como(uEnc, () => t.falla(() => t.q(`select public.dejar_caja_sin_contar($1, '  ')`, [tv]), /motivo/));
  const r = await como(uEnc, async () => (await t.q(`select public.dejar_caja_sin_contar($1, 'Se perdió el cajón en la mudanza') as r`, [tv]))[0].r);
  assert.equal(r.estado, "sin_contar_dejada"); assert.equal(r.revisado_nota, "Se perdió el cajón en la mudanza");
  assert.equal((await como(uEnc, async () => (await t.q(`select public.cajas_para_revisar($1) as l`, [t.g]))[0].l)).length, 0);
});

test("pasada la hora, quien la abrió todavía puede contarla (queda anotado que se cerró sola)", async () => {
  const tv = await como(uRec2, async () => (await t.q(`select public.abrir_caja($1, 300) as id`, [caja2]))[0].id);
  await t.q(`update public.turnos_caja set abierto_en = now() - interval '1 day' where id = $1`, [tv]);
  await como(uRec, () => t.falla(() => t.q(`select public.cerrar_caja($1, 300)`, [tv]), /Sin permiso para contar la caja de otra persona/));
  const r = await como(uRec2, async () => (await t.q(`select public.cerrar_caja($1, 300) as r`, [tv]))[0].r);
  assert.equal(r.estado, "contada_despues"); assert.equal(Number(r.diferencia), 0);
});

test("turno abierto más de N horas (por defecto 14) también es sin contar", async () => {
  const tv = await como(uRec2, async () => (await t.q(`select public.abrir_caja($1, 100) as id`, [caja2]))[0].id);
  await t.q(`update public.turnos_caja set abierto_en = now() - interval '15 hours' where id = $1`, [tv]);
  const [{ s }] = await t.q(`select (privado.turno_vence($1) <= now()) as s`, [tv]);
  assert.equal(s, true);
  await t.q(`update public.turnos_caja set abierto_en = now() where id = $1`, [tv]);
  const [{ s2 }] = await t.q(`select (privado.turno_vence($1) <= now()) as s2`, [tv]);
  assert.equal(s2, false, "recién abierto, sigue abierto");
});

test("reporte X y Z: SOBRA / FALTA, por medio, retiros, y lo sin contar aparte", async () => {
  const [{ id: tb }] = await t.q(`select id from public.turnos_caja where caja_id = $1 and cerrado_en is null`, [caja2]);
  await como(uRec2, () => cuota(tb, t.ctx.socios.vencida));
  await como(uRec2, () => t.q(`select public.movimiento_caja($1, 'retiro', 1000, 'Hielo')`, [tb]));
  await como(uRec2, () => t.falla(() => t.q(`select public.reporte_turno($1)`, [tb]), /Sin permiso/));      // abierto: arqueo ciego
  const x = await como(uEnc, async () => (await t.q(`select public.reporte_turno($1) as r`, [tb]))[0].r);      // X
  assert.equal(x.estado, "abierto"); assert.equal(Number(x.esperado), 100 + 25000 - 1000);
  await como(uRec2, () => t.q(`select public.cerrar_caja($1, 23000, 'Faltan 1100')`, [tb]));
  const z1 = await como(uRec2, async () => (await t.q(`select public.reporte_turno($1) as r`, [tb]))[0].r);
  assert.equal(Number(z1.diferencia), -1100); assert.equal(z1.estado, "cerrado");
  assert.equal(z1.movimientos.length, 1); assert.equal(Number(z1.ventas.cantidad), 1);
  assert.equal(Number(z1.por_medio.find((m) => m.medio === "efectivo").total), 25000);
  await como(uRec, () => t.falla(() => t.q(`select public.reporte_turno($1)`, [tb]), /Sin permiso/));          // otra recepción: no
  await como(uRec2, () => t.falla(() => t.q(`select public.reporte_dia($1)`, [t.sede]), /Sin permiso/));
  const z = await como(uDueno, async () => (await t.q(`select public.reporte_dia($1) as r`, [t.sede]))[0].r);
  assert.ok(z.turnos.length >= 2);
  const contados = z.turnos.filter((u) => u.contado != null);
  assert.equal(Number(z.diferencia), contados.reduce((s, u) => s + Number(u.diferencia), 0));
  assert.ok(Number(z.diferencia) <= -1100, "la falta del día aparece");
});

test("una caja por día: después de cerrar, esa caja no se vuelve a abrir hoy", async () => {
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_config_caja($1, 'una_por_dia', false, 0, '00:00', 14)`, [t.g]), /Sin permiso/));
  const c = await como(uDueno, async () => (await t.q(`select public.guardar_config_caja($1, 'una_por_dia', false, 5000, '00:00', 14) as c`, [t.g]))[0].c);
  assert.equal(c.modo, "una_por_dia"); assert.equal(Number(c.fondo_fijo), 5000);
  await como(uRec2, () => t.falla(() => t.q(`select public.abrir_caja($1, 0)`, [caja2]), /una sola caja por día/));
  const mi = await como(uRec2, async () => (await t.q(`select public.mi_turno_caja($1) as m`, [t.sede]))[0].m);
  assert.ok(!mi.libres.some((l) => l.caja_id === caja2), "no se ofrece abrirla");
  assert.equal(mi.modo, "una_por_dia");
  const h = await t.q(`select campo from public.historial_configuracion where gimnasio_id = $1 and campo like 'caja.%'`, [t.g]);
  assert.ok(h.length >= 2, "el cambio de configuración queda en el historial");
  await como(uDueno, () => t.q(`select public.guardar_config_caja($1, 'por_turno', false, 0, '00:00', 14)`, [t.g]));
});

test("billetes: la calculadora es opcional, pero si se usa tiene que sumar; el gimnasio puede exigirla", async () => {
  const tv = await como(uEnc, async () => (await t.q(`select public.abrir_caja($1, 100) as id`, [caja2]))[0].id);
  await como(uEnc, () => t.falla(() => t.q(`select public.cerrar_caja($1, 100, null, '{"20000": 1}'::jsonb)`, [tv]), /suman \$20\.000 y escribiste \$100/));
  await como(uDueno, () => t.q(`select public.guardar_config_caja($1, 'por_turno', true, 0, '00:00', 14)`, [t.g]));
  await como(uEnc, () => t.falla(() => t.q(`select public.cerrar_caja($1, 100)`, [tv]), /pide contar los billetes/));
  const r = await como(uEnc, async () => (await t.q(`select public.cerrar_caja($1, 1350, null, '{"1000": 1, "200": 1, "otros": 150}'::jsonb) as r`, [tv]))[0].r);
  assert.equal(Number(r.contado), 1350); assert.deepEqual(r.billetes, { 1000: 1, 200: 1, otros: 150 });
});
