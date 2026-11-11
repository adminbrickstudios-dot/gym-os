// Carril B · F2.1 a F2.5: soporte con rol, buscar a cualquiera, lista, tablero y ficha.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, admin, uDueno, uRec, eRec, eDueno, mailRec;
// Como el usuario, pero lo escrito se conserva (comoUsuario deshace al salir).
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const uno = async (sql, p) => (await t.q(sql, p))[0];
before(async () => {
  t = await abrir("prueba-sa-f2");
  admin = (await uno(`insert into auth.users (email) values ($1) returning id`, [`a${Math.random()}@ejemplo.invalid`])).id;
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
  for (const rol of ["dueno", "recepcion"]) {
    const id = (await uno(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random().toString().slice(2)}@ejemplo.invalid`])).id;
    const eq = (await uno(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, rol, rol])).id;
    if (rol === "dueno") { uDueno = id; eDueno = eq; } else { uRec = id; eRec = eq; mailRec = (await uno(`select email from auth.users where id = $1`, [id])).email; }
  }
});
after(async () => t && t.cerrar());

test("F2.2 soporte con rol: elige rol, motivo obligatorio, el dueño ve el rol, queda registrado", async () => {
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_entrar_gimnasio($1, 'quiero mirar', 'recepcion')`, [t.g]), /administradores/));
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_entrar_gimnasio($1, 'abc', 'recepcion')`, [t.g]), /motivo/);
    await t.falla(() => t.q(`select public.admin_entrar_gimnasio($1, 'motivo válido', 'encargado')`, [t.g]), /rol/);
    const [{ s }] = await t.q(`select public.admin_entrar_gimnasio($1, 'No puede cobrar una venta', 'recepcion') s`, [t.g]);
    assert.equal(s, "prueba-sa-f2");
    const [r] = await t.q(`select rol, es_soporte, activo from public.equipo where gimnasio_id = $1 and usuario_id = $2`, [t.g, admin]);
    assert.deepEqual(r, { rol: "recepcion", es_soporte: true, activo: true });
    await t.q(`select public.admin_entrar_gimnasio($1, 'Ahora reviso los planes', 'profe')`, [t.g]);
    assert.equal((await uno(`select rol from public.equipo where gimnasio_id = $1 and usuario_id = $2`, [t.g, admin])).rol, "profe");
  });
  const vistos = await como(uDueno, () => t.q(`select public.soportes_del_gimnasio($1) x`, [t.g]));
  const ult = vistos[0].x.find((v) => v.motivo === "Ahora reviso los planes");
  assert.equal(ult.rol, "profe");

  const log = await t.q(`select accion, detalle from public.registro_brik where gimnasio_id = $1 and accion = 'entrar_como_soporte'`, [t.g]);
  assert.equal(log.length, 2);
});

test("registro_brik: nadie lo edita ni lo borra", async () => {
  await t.q(`insert into public.registro_brik (usuario_id, accion) values ($1, 'prueba')`, [admin]);
  await t.falla(() => t.q(`delete from public.registro_brik where true`), /no se borran/);
  await t.falla(() => t.q(`update public.registro_brik set accion = 'otra'`), /solo se puede cambiar/);
});

test("F2.3 buscar a cualquiera: pide motivo, solo admin, no devuelve datos de contacto, deja registro", async () => {
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, dni, email, telefono) values ($1,'Lucía','Búsqueda','31999888','lucia.busca@ejemplo.invalid','+5490001234567')`, [t.g]);
  await como(uRec, () => t.falla(() => t.q(`select public.admin_buscar_persona('lucia.busca@ejemplo.invalid', 'me escribió')`), /administradores/));
  await como(admin, async () => {
    await t.falla(() => t.q(`select public.admin_buscar_persona('lucia.busca@ejemplo.invalid', '')`), /motivo/);
    await t.falla(() => t.q(`select public.admin_buscar_persona('ab', 'me escribió')`), /4 caracteres/);
    for (const q of ["lucia.busca@ejemplo.invalid", "31999888", "+54 9 000 1234567"]) {
      const [{ r }] = await t.q(`select public.admin_buscar_persona($1, 'No puede entrar y no sé de qué gimnasio es') r`, [q]);
      assert.equal(r.length, 1, q);
      assert.equal(r[0].gimnasio_id, t.g);
      assert.equal(r[0].rol, "socio");
      assert.deepEqual(Object.keys(r[0]).filter((k) => /mail|dni|tel/.test(k)), [], "sin datos de contacto");
    }
    const [{ r: eq }] = await t.q(`select public.admin_buscar_persona($1, 'busco a la recepcionista') r`, [mailRec]);
    assert.equal(eq[0].rol, "recepcion");
  });
  const log = await t.q(`select detalle from public.registro_brik where accion = 'buscar_persona'`);
  assert.equal(log.length, 4);
  assert.ok(log.every((l) => l.detalle.motivo));
});

test("F2.4 lista: filtros por texto, salud, abono; favoritos arriba", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.admin_lista_gimnasios()`), /administradores/));
  await como(admin, async () => {
    const [{ l }] = await t.q(`select public.admin_lista_gimnasios() l`);
    const f = l.find((x) => x.gimnasio_id === t.g);
    assert.ok(f); assert.ok(f.socios_activos > 0); assert.equal(typeof f.entradas_hoy, "number"); assert.ok(f.color);
    assert.equal((await uno(`select jsonb_array_length(public.admin_lista_gimnasios('prueba-sa-f2')) n`)).n, 1);
    assert.equal((await uno(`select jsonb_array_length(public.admin_lista_gimnasios('no-existe-xyz')) n`)).n, 0);
    assert.equal((await uno(`select jsonb_array_length(public.admin_lista_gimnasios(p_abono => 'vencido')) n`)).n, 0);
    await t.falla(() => t.q(`select public.admin_lista_gimnasios(p_salud => 'azul')`), /Salud/);
    // abono vencido: aparece en el filtro
    const plan = (await uno(`select public.admin_guardar_plan_brik(null, 'Plan F2', 30000) id`)).id;
    await t.q(`select public.admin_asignar_plan_brik($1, $2)`, [t.g, plan]);
    await t.q(`update public.gimnasios set plataforma_desde = current_date - 40 where id = $1`, [t.g]);
    assert.equal((await uno(`select jsonb_array_length(public.admin_lista_gimnasios(p_abono => 'vencido')) n`)).n, 1);
    assert.equal((await uno(`select jsonb_array_length(public.admin_lista_gimnasios(p_plan => 'plan f2', p_salud => 'rojo')) n`)).n, 1);
    // favorito primero
    await t.q(`insert into public.gimnasios (slug, nombre) values ('aaa-otro-f2', 'AAA Otro')`);
    await t.q(`select public.admin_marcar_favorito($1, true)`, [t.g]);
    const l2 = (await uno(`select public.admin_lista_gimnasios() l`)).l;
    assert.equal(l2[0].gimnasio_id, t.g); assert.equal(l2[0].favorito, true);
    await t.q(`select public.admin_marcar_favorito($1, false)`, [t.g]);
  });
});

test("F2.5 tablero: números que llevan a su lista y 'necesitan atención' con el motivo escrito", async () => {
  await como(uDueno, () => t.falla(() => t.q(`select public.admin_tablero()`), /administradores/));
  await t.q(`insert into public.eventos_webhook (origen, tipo, id_externo, gimnasio_id, error) values ('mp_cobros', 'payment', 'f2-1', $1, 'no se pudo')`, [t.g]);
  await como(admin, async () => {
    const [{ x }] = await t.q(`select public.admin_tablero() x`);
    for (const k of ["activos_hoy", "entradas_hoy", "cobrado_hoy", "ingreso_mensual_brik", "abonos_por_vencer", "ayudas_sin_responder"]) {
      assert.ok(x.numeros[k], k); assert.ok(x.numeros[k].lista, `${k} lleva a una lista`); assert.notEqual(x.numeros[k].valor, undefined);
    }
    const mios = x.necesitan_atencion.filter((a) => a.gimnasio_id === t.g);
    assert.ok(mios.some((a) => /Abono a BRIK vencido/.test(a.motivo)), "abono vencido");
    assert.ok(mios.some((a) => a.tipo === "webhooks" && /1 aviso de MercadoPago falló/.test(a.motivo)), "webhook fallido");
    assert.ok(mios.every((a) => a.motivo && a.boton));
    assert.ok(Array.isArray(x.actividad));
  });
});

test("F2.1 ficha: cambiar dueño, apagar Clases, cambiar slug, registro y webhooks fallidos", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.admin_cambiar_dueno($1, $2)`, [t.g, eRec]), /administradores/));
  await como(admin, async () => {
    await t.q(`select public.admin_cambiar_dueno($1, $2)`, [t.g, eRec]);
    assert.equal((await uno(`select rol from public.equipo where id = $1`, [eRec])).rol, "dueno");
    assert.equal((await uno(`select rol from public.equipo where id = $1`, [eDueno])).rol, "encargado");
    await t.falla(() => t.q(`select public.admin_cambiar_dueno($1, $2)`, [t.g, eRec]), /Ya es el dueño/);
    await t.q(`select public.admin_guardar_modulos($1, array['clases'])`, [t.g]);
    assert.deepEqual((await uno(`select secciones_apagadas s from public.configuracion_gimnasio where gimnasio_id = $1`, [t.g])).s, ["clases"]);
    await t.falla(() => t.q(`select public.admin_guardar_modulos($1, array['inventada'])`, [t.g]), /no existe/);
    await t.falla(() => t.q(`select public.admin_cambiar_slug($1, 'Mal Slug!')`, [t.g]), /slug/);
    await t.q(`select public.admin_cambiar_slug($1, 'slug-nuevo-f2')`, [t.g]);
    const [{ x }] = await t.q(`select public.admin_ficha_extra($1) x`, [t.g]);
    assert.deepEqual(x.secciones_apagadas, ["clases"]);
    assert.equal(x.webhooks_fallidos.length, 1);
    assert.deepEqual(new Set(x.registro.map((r) => r.accion)), new Set(["entrar_como_soporte", "cambiar_dueno", "guardar_modulos", "cambiar_slug"]));
    assert.ok(!JSON.stringify(x).includes("payload"), "no muestra el contenido de los webhooks");
  });
});
