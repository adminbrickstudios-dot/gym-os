// Lo que leen y escriben los paneles (migración 0013). Cada función se
// llama como la llamaría la pantalla: con el rol de la persona logueada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, u = {}, eq = {};

async function persona(rol, sede = null, gimnasio = null) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  const [{ id }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, sede_id) values ($1,$2,$3,$4,$5) returning id`,
    [gimnasio ?? t.g, usuario, `Persona ${rol}`, rol, sede]);
  return { usuario, id };
}
const rpc = async (usuario, sql, params) => t.comoUsuario(usuario, async () => (await t.q(sql, params)));
const uno = async (usuario, sql, params) => (await rpc(usuario, sql, params))[0];

before(async () => {
  t = await abrir("prueba-paneles");
  [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-paneles-otro', 'Otro') returning id`);
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) ({ usuario: u[rol], id: eq[rol] } = await persona(rol));
  ({ usuario: u.ajeno } = await persona("dueno", null, otro));
  [{ id: u.admin }] = await t.q(`insert into auth.users (email) values ('admin-prueba@ejemplo.invalid') returning id`);
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [u.admin]);
});
after(async () => t && t.cerrar());

test("mi_sesion: dice en qué gimnasio trabajo y con qué rol; sin sesión, error", async () => {
  const { r } = await uno(u.recepcion, `select public.mi_sesion() as r`);
  assert.equal(r.es_admin, false);
  assert.equal(r.equipo.length, 1);
  assert.equal(r.equipo[0].rol, "recepcion");
  assert.equal(r.equipo[0].gimnasio_id, t.g);
  const { r: adm } = await uno(u.admin, `select public.mi_sesion() as r`);
  assert.equal(adm.es_admin, true);
  await t.falla(() => t.q(`select public.mi_sesion()`), /iniciar sesión/);
});

test("panel_gimnasio: marca y secciones; clases apagadas si el gimnasio no tiene clases", async () => {
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'ninguno', secciones_apagadas = '{rutinas}' where gimnasio_id = $1`, [t.g]);
  const { r } = await uno(u.dueno, `select public.panel_gimnasio($1) as r`, [t.g]);
  assert.equal(r.yo.rol, "dueno");
  assert.deepEqual(r.secciones_apagadas.sort(), ["clases", "rutinas"]);
  assert.match(r.marca.color_fondo, /^#/);
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.panel_gimnasio($1)`, [t.g]), /Sin permiso/));
});

test("panel_inicio: la recepción no ve lo cobrado; el dueño sí; otro gimnasio recibe error", async () => {
  const { r: rec } = await uno(u.recepcion, `select public.panel_inicio($1) as r`, [t.g]);
  const { r: due } = await uno(u.dueno, `select public.panel_inicio($1) as r`, [t.g]);
  assert.equal(rec.numeros.length, 4);
  assert.equal(due.numeros.length, 4);
  assert.ok(!rec.numeros.some((n) => n.clave === "cobrado"));
  assert.ok(due.numeros.some((n) => n.clave === "cobrado"));
  assert.ok(Array.isArray(due.ahora));
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.panel_inicio($1)`, [t.g]), /Sin permiso/));
});

test("panel_inicio: el profe ve sus clases, no la plata ni los vencimientos", async () => {
  const { r } = await uno(u.profe, `select public.panel_inicio($1) as r`, [t.g]);
  assert.deepEqual(r.numeros.map((n) => n.clave), ["mis_clases", "anotados", "presentes", "faltan"]);
  assert.ok(!r.ahora.some((a) => ["vencen", "transferencias", "caja"].includes(a.tipo)));
});

test("panel_inicio: una recepción de otra sede no puede mirar la principal", async () => {
  const [{ id: sedeB }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1,'Sede B') returning id`, [t.g]);
  const { usuario } = await persona("recepcion", sedeB);
  await t.comoUsuario(usuario, () => t.falla(() => t.q(`select public.panel_inicio($1, $2)`, [t.g, t.sede]), /esa sede/));
});

test("accesos rápidos: se guardan por persona y se validan", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    await t.q(`select public.guardar_accesos_rapidos($1, $2)`, [t.g, ["entrada", "vender", "socios"]]);
    const [{ r }] = await t.q(`select public.panel_gimnasio($1) as r`, [t.g]);
    assert.deepEqual(r.yo.accesos, ["entrada", "vender", "socios"]);
    await t.falla(() => t.q(`select public.guardar_accesos_rapidos($1, $2)`, [t.g, ["entrada", "entrada"]]), /repetidos/);
    await t.falla(() => t.q(`select public.guardar_accesos_rapidos($1, $2)`, [t.g, []]), /al menos un acceso/);
  });
});

test("buscar_socios: el color y el texto son los mismos que da la puerta", async () => {
  const filas = await rpc(u.recepcion, `select * from public.buscar_socios($1, '', 100)`, [t.g]);
  assert.ok(filas.length >= 15);
  for (const f of filas.slice(0, 8)) {
    const [v] = await t.q(`select (x).color, (x).texto from (select privado.calcular_acceso($1, now(), null) x) y`, [f.socio_id]);
    assert.equal(f.color, v.color);
    assert.equal(f.texto, v.texto);
  }
  const [s] = await t.q(`select id, nombre, dni from public.socios where gimnasio_id = $1 and dni is not null limit 1`, [t.g]);
  if (s) {
    const porDni = await rpc(u.recepcion, `select socio_id from public.buscar_socios($1, $2)`, [t.g, s.dni]);
    assert.ok(porDni.some((x) => x.socio_id === s.id));
  }
  await t.comoUsuario(u.profe, () => t.falla(() => t.q(`select * from public.buscar_socios($1, 'a')`, [t.g]), /Sin permiso/));
});

test("guardar_socio: alta con número, validaciones claras, DNI único, sin datos de salud", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    const [{ id }] = await t.q(`select public.guardar_socio($1, null, $2) as id`,
      [t.g, { nombre: "Lucía", apellido: "Pérez", dni: "30.111.222", telefono: "+54 9 000 555-1234" }]);
    const [s] = await t.q(`select public.ficha_socio($1) as f`, [id]);
    assert.equal(s.f.socio.dni, "30111222");
    assert.equal(s.f.socio.telefono, "+5490005551234");
    assert.ok(s.f.socio.numero > 0);
    assert.equal(s.f.pagos, null, "la recepción no ve el historial de pagos");
    await t.falla(() => t.q(`select public.guardar_socio($1, null, $2)`, [t.g, { nombre: "Otra", dni: "30111222" }]), /Ya hay un socio con el DNI/);
    // Desde 0033 el teléfono se escribe como lo dice la gente; lo inválido sigue con error claro.
    const [{ id: x }] = await t.q(`select public.guardar_socio($1, null, $2) as id`, [t.g, { nombre: "X", telefono: "387 15 555-1239" }]);
    assert.equal((await t.q(`select telefono from public.socios where id = $1`, [x]))[0].telefono, "+5493875551239");
    await t.falla(() => t.q(`select public.guardar_socio($1, null, $2)`, [t.g, { nombre: "X", telefono: "123" }]), /característica/);
    await t.falla(() => t.q(`select public.guardar_socio($1, null, $2)`, [t.g, { nombre: "" }]), /obligatorio/);
  });
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.guardar_socio($1, null, $2)`, [t.g, { nombre: "Z" }]), /Sin permiso/));
});

test("planes y precios: el encargado crea y programa; la recepción no", async () => {
  await t.comoUsuario(u.encargado, async () => {
    const [{ id }] = await t.q(`select public.guardar_plan($1, null, $2) as id`, [t.g, { tipo: "membresia", nombre: "Libre noche", duracion_meses: 1 }]);
    await t.q(`select public.programar_precio($1, 30000)`, [id]);
    await t.q(`select public.programar_precio($1, 35000, '2099-01-01')`, [id]);
    const planes = await t.q(`select * from public.planes_gimnasio($1)`, [t.g]);
    const p = planes.find((x) => x.plan_id === id);
    assert.equal(Number(p.precio), 30000);
    assert.equal(Number(p.proximo_precio), 35000);
    await t.falla(() => t.q(`select public.programar_precio($1, 0)`, [id]), /mayor a cero/);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.guardar_plan($1, null, $2)`, [t.g, { tipo: "pack", nombre: "x" }]), /Sin permiso/));
});

test("configuración: solo el dueño; campos desconocidos y secciones inventadas se rechazan", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { color_fondo: "#101010", secciones_apagadas: ["rutinas"], tolerancia_dias: 3 }]);
    const [{ c }] = await t.q(`select public.configuracion_panel($1) as c`, [t.g]);
    assert.equal(c.color_fondo, "#101010");
    assert.equal(c.tolerancia_dias, 3);
    await t.falla(() => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { ultimo_numero_socio: 1 }]), /no se pueden cambiar/);
    await t.falla(() => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { secciones_apagadas: ["inventada"] }]), /desconocida/);
    await t.falla(() => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { color_fondo: "negro" }]), /Color de fondo: tiene que ser un color/);
  });
  await t.comoUsuario(u.encargado, () => t.falla(() => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, { tolerancia_dias: 1 }]), /Sin permiso/));
});

test("configuración (0020): cada valor imposible dice qué campo y qué poner, nunca el error crudo de la base", async () => {
  const guardar = (datos) => t.q(`select public.guardar_configuracion($1, $2)`, [t.g, datos]);
  await t.comoUsuario(u.dueno, async () => {
    const casos = [
      [{ tolerancia_dias: 999 }, /Días de tolerancia: tiene que estar entre 0 y 60/],
      [{ tolerancia_dias: "" }, /Días de tolerancia: no puede quedar vacío/],
      [{ tolerancia_dias: "tres" }, /número entero entre 0 y 60/],
      [{ dias_aviso: 31 }, /aviso.*entre 0 y 30/],
      [{ descuento_max_recepcion: 150 }, /Descuento máximo de recepción: tiene que estar entre 0 y 100 %/],
      [{ descuento_max_recepcion: "" }, /Descuento.*no puede quedar vacío/],
      [{ retencion_dias_ausencia: 1 }, /sin venir.*entre 3 y 90/],
      [{ reserva_dias_anticipacion: 61 }, /anticipación.*entre 0 y 60/],
      [{ cancelacion_horas_limite: 100 }, /cancelar.*entre 0 y 72/],
      [{ alias_transferencia: "alias con espacios!!" }, /alias tiene que tener de 6 a 20/],
      [{ alias_transferencia: "abc" }, /alias tiene que tener de 6 a 20/],
      [{ cbu: "123" }, /22 números.*tiene 3/],
      [{ color_acento: "#12345" }, /Color principal: tiene que ser un color/],
      [{ modo_clases: "a veces" }, /cómo funcionan las clases/],
      [{ nombre: "   " }, /nombre del gimnasio es obligatorio/],
      [{ nombre: "x".repeat(61) }, /hasta 60 letras/],
      [{ cobra_membresia: "si" }, /Membresía: tiene que ser sí o no/],
      [{ accesos_activos: [] }, /al menos una forma de entrar/],
      [{ accesos_activos: ["telepatia"] }, /Forma de entrada desconocida/],
      [{ cobra_membresia: false, cobra_pase: false, cobra_pack: false }, /al menos una forma de cobrar/],
    ];
    for (const [datos, patron] of casos) await t.falla(() => guardar(datos), patron);

    // Lo válido se guarda; el CBU con espacios y guiones se limpia; vacío borra el alias.
    await guardar({ tolerancia_dias: "5", alias_transferencia: "gym.norte-ok", cbu: "0000003 100 0999 9000-0001", descuento_max_recepcion: "12.5" });
    let [{ c }] = await t.q(`select public.configuracion_panel($1) as c`, [t.g]);
    assert.equal(c.tolerancia_dias, 5);
    assert.equal(c.alias_transferencia, "gym.norte-ok");
    assert.equal(c.cbu, "0000003100099990000001");
    assert.equal(Number(c.descuento_max_recepcion), 12.5);
    await guardar({ alias_transferencia: "", cbu: "" });
    [{ c }] = await t.q(`select public.configuracion_panel($1) as c`, [t.g]);
    assert.equal(c.alias_transferencia, null);
    assert.equal(c.cbu, null);
    // Apagar dos formas de cobro está bien mientras quede una.
    await guardar({ cobra_membresia: true, cobra_pase: false, cobra_pack: false });
    await guardar({ cobra_pase: true, cobra_pack: true });
  });
});

test("equipo: el dueño agrega gente; no se puede quedar sin dueño; vincular el login es solo del servidor", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const [{ id }] = await t.q(`select public.guardar_equipo($1, null, 'Nueva Recepción', 'recepcion') as id`, [t.g]);
    assert.ok(id);
    await t.falla(() => t.q(`select public.guardar_equipo($1, $2, 'Yo', 'encargado')`, [t.g, eq.dueno]), /dueño/);
    const lista = await t.q(`select * from public.equipo_gimnasio($1)`, [t.g]);
    assert.ok(lista.find((x) => x.soy_yo).rol === "dueno");
  });
  await t.comoUsuario(u.encargado, () => t.falla(() => t.q(`select public.guardar_equipo($1, null, 'X', 'profe')`, [t.g]), /Sin permiso/));
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.vincular_usuario_equipo($1, $2)`, [eq.profe, u.dueno]), /permission denied|servidor/));
});

test("super admin: lista y crea gimnasios; un dueño no puede", async () => {
  await t.comoUsuario(u.admin, async () => {
    const [{ r }] = await t.q(`select public.admin_crear_gimnasio('olympo-prueba', 'Olympo', 'ejemplo.invalid', 'Dueño Olympo') as r`);
    assert.equal(r.host, "olympo-prueba.ejemplo.invalid");
    const lista = await t.q(`select * from public.admin_gimnasios()`);
    const g = lista.find((x) => x.slug === "olympo-prueba");
    assert.deepEqual(g.duenos, ["Dueño Olympo"]);
    await t.falla(() => t.q(`select public.admin_crear_gimnasio('olympo-prueba', 'X', 'ejemplo.invalid', 'Y')`), /Ya existe/);
    await t.falla(() => t.q(`select public.admin_crear_gimnasio('Con Espacios', 'X', 'ejemplo.invalid', 'Y')`), /minúsculas/);
  });
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select * from public.admin_gimnasios()`), /administradores/));
});

test("ingresos_del_dia: la entrada ve lo de hoy; el profe no", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    const [s] = await t.q(`select socio_id from public.buscar_socios($1, '', 50) where puede limit 1`, [t.g]);
    await t.q(`select public.registrar_ingreso($1, $2)`, [s.socio_id, t.sede]);
    const lista = await t.q(`select * from public.ingresos_del_dia($1)`, [t.g]);
    assert.ok(lista.some((x) => x.socio_id === s.socio_id));
  });
  await t.comoUsuario(u.profe, () => t.falla(() => t.q(`select * from public.ingresos_del_dia($1)`, [t.g]), /Sin permiso/));
});

test("grilla: el encargado arma actividades y horarios; cerrar un horario cancela sus clases futuras", async () => {
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [t.g]);
  await t.comoUsuario(u.encargado, async () => {
    const [{ id: act }] = await t.q(`select public.guardar_actividad($1, null, 'Box', '🥊') as id`, [t.g]);
    const [{ id: h }] = await t.q(`select public.agregar_horario($1, $2, extract(isodow from current_date + 1)::int, '23:00', 60, 10) as id`, [t.sede, act]);
    const [{ id: c }] = await t.q(`select clase_id as id from public.clases_del_dia($1, current_date + 1) where actividad = 'Box'`, [t.sede]);
    const [{ d }] = await t.q(`select public.clase_detalle($1) as d`, [c]);
    assert.equal(d.actividad, "Box");
    await t.q(`select public.cerrar_horario($1)`, [h]);
    const [{ x }] = await t.q(`select public.clase_detalle($1) as x`, [c]);
    assert.equal(x.cancelada, true);
    await t.falla(() => t.q(`select public.agregar_horario($1, $2, 9, '10:00', 60)`, [t.sede, act]), /Elegí el día/);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.guardar_actividad($1, null, 'X', null)`, [t.g]), /Sin permiso/));
});

test("usuario_por_mail: solo el servidor puede averiguar si un mail tiene cuenta", async () => {
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.usuario_por_mail('admin-prueba@ejemplo.invalid')`), /permission denied|servidor/));
  await t.db.query("savepoint s2");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  const [{ id }] = await t.q(`select public.usuario_por_mail('ADMIN-prueba@ejemplo.invalid') as id`);
  await t.db.query("rollback to savepoint s2");
  assert.equal(id, u.admin);
});

test("app del socio: ve su estado sin indicaciones para la recepción; otro login no lo ve; vincular por teléfono es del servidor", async () => {
  const s = t.ctx.socios.vence_hoy;
  const [{ id: usuario }] = await t.q(`insert into auth.users (phone, phone_confirmed_at) values ('+5490000777001', now()) returning id`);
  await t.q(`update public.socios set telefono = '+5490000777001' where id = $1`, [s]);
  await t.comoUsuario(usuario, () => t.falla(() => t.q(`select public.mi_socio($1)`, [t.g]), /no es de ningún socio/));
  await t.comoUsuario(usuario, () => t.falla(() => t.q(`select public.vincular_socios_por_telefono($1, $2)`, [t.g, usuario]), /permission denied|servidor/));
  await t.db.query("savepoint v");
  await t.db.query("set local role service_role");
  await t.q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  const [{ n }] = await t.q(`select public.vincular_socios_por_telefono($1, $2) as n`, [t.g, usuario]);
  await t.db.query("reset role");
  assert.equal(n, 1);
  const [{ r }] = await t.comoUsuario(usuario, () => t.q(`select public.mi_socio($1) as r`, [t.g]));
  assert.equal(r.socio.socio_id, s);
  assert.doesNotMatch(r.acceso.texto, /avisale/);
  assert.ok(r.zona);
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.mi_socio($1, $2)`, [t.g, s]), /no es de ningún socio/));
  await t.db.query("rollback to savepoint v");
});
