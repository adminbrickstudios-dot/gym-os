// VD-44 · Equipo con foto, clases y horario: quién edita, y lo público solo si está prendido.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, uDueno, uEnc, uRec, uProfe, uOtro, uSocio, ana, act, clase;
const MANIANA = sumarDias(HOY, 1);

// Como comoUsuario de _comun, pero lo que escribe queda (las pruebas siguientes lo ven).
async function como(usuarioId, fn) {
  await t.db.query(`set local role authenticated`);
  await t.db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuarioId, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query(`reset role`); await t.db.query(`select set_config('request.jwt.claims', '', true)`); }
}
async function comoAnon(fn) {
  await t.db.query("savepoint a");
  try {
    await t.db.query(`set local role anon`);
    return await fn();
  } finally { await t.db.query("rollback to savepoint a"); }
}
const usuario = async (email) => (await t.q(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id;
const persona = async (u, nombre, rol) => (await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, u, nombre, rol]))[0].id;
const ruta = (id, n = "a") => `${t.g}/${id}/foto-${n.repeat(32)}.webp`;

before(async () => {
  t = await abrir("prueba-equipo-perfil");
  await t.q(`update public.configuracion_gimnasio set modo_clases = 'reserva' where gimnasio_id = $1`, [t.g]);
  uDueno = await usuario("d@ejemplo.invalid"); uEnc = await usuario("e@ejemplo.invalid"); uRec = await usuario("r@ejemplo.invalid");
  uProfe = await usuario("p@ejemplo.invalid"); uOtro = await usuario("o@ejemplo.invalid");
  await persona(uDueno, "Dueña", "dueno"); await persona(uEnc, "Beto", "encargado"); await persona(uRec, "Sofi", "recepcion");
  ana = await persona(uProfe, "Ana", "profe"); await persona(uOtro, "Juan", "profe");
  [{ id: act }] = await t.q(`insert into public.actividades (gimnasio_id, nombre, emoji) values ($1,'Spinning','🚴') returning id`, [t.g]);
  await t.q(`insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, profe_id, vigente_desde)
             values ($1,$2,$3,7,'19:00',50,5,$4,'2026-01-01')`, [t.g, t.sede, act, ana]);
  await t.q(`select privado.materializar_dia($1, $2::date)`, [t.sede, MANIANA]);
  [{ id: clase }] = await t.q(`select id from public.clases where gimnasio_id = $1`, [t.g]);
  uSocio = (await t.q(`insert into auth.users (phone) values ('+5490000555111') returning id`))[0].id;
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [t.ctx.socios.al_dia, uSocio]);
});
after(async () => t && t.cerrar());

const horario = [{ dia: 1, desde: "09:00", hasta: "13:00" }, { dia: 1, desde: "17:00", hasta: "21:00" }, { dia: 3, desde: "09:00", hasta: "13:00" }];

test("dueño y encargado guardan clases y horario; recepción, profe y socio no", async () => {
  await como(uEnc, async () => {
    await t.q(`select public.guardar_perfil_equipo($1,$2,true,$3,$4)`, [t.g, ana, [act], JSON.stringify(horario)]);
    const [{ r }] = await t.q(`select public.equipo_perfiles($1) as r`, [t.g]);
    const p = r.personas.find((x) => x.equipo_id === ana);
    assert.equal(p.mostrar, true);
    assert.deepEqual(p.actividades, [act]);
    assert.equal(p.horario.length, 3);
    assert.equal(p.horario[0].desde, "09:00");
  });
  for (const u of [uRec, uProfe, uSocio]) {
    await como(u, () => t.falla(() => t.q(`select public.guardar_perfil_equipo($1,$2,true,'{}','[]')`, [t.g, ana]), /Sin permiso/));
    await como(u, () => t.falla(() => t.q(`select public.guardar_equipo_ajuste($1,true)`, [t.g]), /Sin permiso/));
  }
  // El encargado no prende lo público: es del dueño.
  await como(uEnc, () => t.falla(() => t.q(`select public.guardar_equipo_ajuste($1,true)`, [t.g]), /Sin permiso/));
});

test("el horario no admite horas al revés ni franjas que se pisan, y las actividades tienen que ser del gimnasio", async () => {
  await como(uDueno, async () => {
    await t.falla(() => t.q(`select public.guardar_perfil_equipo($1,$2,false,'{}',$3)`, [t.g, ana, JSON.stringify([{ dia: 2, desde: "13:00", hasta: "09:00" }])]), /tiene que ser después/);
    await t.falla(() => t.q(`select public.guardar_perfil_equipo($1,$2,false,'{}',$3)`, [t.g, ana, JSON.stringify([{ dia: 2, desde: "09:00", hasta: "13:00" }, { dia: 2, desde: "12:00", hasta: "15:00" }])]), /se pisan/);
    await t.falla(() => t.q(`select public.guardar_perfil_equipo($1,$2,false,$3,'[]')`, [t.g, ana, ["11111111-1111-4111-8111-111111111111"]]), /no es de este gimnasio/);
  });
});

test("el profe ve solo lo suyo en el panel; recepción también", async () => {
  await como(uProfe, async () => {
    const [{ r }] = await t.q(`select public.equipo_perfiles($1) as r`, [t.g]);
    assert.equal(r.personas.length, 1);
    assert.equal(r.personas[0].equipo_id, ana);
  });
});

test("la foto: la cambia dueño/encargado o la propia persona; otro profe no", async () => {
  await como(uOtro, () => t.falla(() => t.q(`select public.preparar_foto_equipo($1,'webp')`, [ana]), /Sin permiso/));
  await como(uRec, () => t.falla(() => t.q(`select public.preparar_foto_equipo($1,'webp')`, [ana]), /Sin permiso/));
  await como(uProfe, async () => {
    const [{ r }] = await t.q(`select public.preparar_foto_equipo($1,'webp') as r`, [ana]);
    assert.match(r, new RegExp(`^${t.g}/${ana}/foto-[0-9a-f]{32}\\.webp$`));
    await t.falla(() => t.q(`select public.guardar_foto_equipo($1,$2)`, [ana, `${t.g}/${ana}/otra.webp`]), /Ruta de foto inválida/);
    await t.falla(() => t.q(`select public.preparar_foto_equipo($1,'exe')`, [ana]), /JPG, PNG o WEBP/);
  });
  await como(uEnc, async () => {
    const [{ r: ant }] = await t.q(`select public.guardar_foto_equipo($1,$2) as r`, [ana, ruta(ana)]);
    assert.equal(ant, null);
    const [{ r: ant2 }] = await t.q(`select public.guardar_foto_equipo($1,$2) as r`, [ana, ruta(ana, "b")]);
    assert.equal(ant2, ruta(ana));
  });
});

test("apagado (por defecto) no se ve nada afuera; prendido, solo lo tildado", async () => {
  // Apagado: ni la foto (anon ni socio), ni los profes de la clase, ni la página.
  await comoAnon(async () => assert.equal((await t.q(`select public.foto_equipo($1) as r`, [ana]))[0].r, null));
  await como(uSocio, async () => {
    assert.equal((await t.q(`select public.foto_equipo($1) as r`, [ana]))[0].r, null);
    assert.deepEqual((await t.q(`select public.profes_de_clases($1) as r`, [[clase]]))[0].r, []);
  });
  assert.deepEqual((await t.q(`select privado.landing_completa($1) -> 'equipo_publico' as r`, [t.g]))[0].r, []);

  await como(uDueno, () => t.q(`select public.guardar_equipo_ajuste($1,true)`, [t.g]));

  await comoAnon(async () => assert.equal((await t.q(`select public.foto_equipo($1) as r`, [ana]))[0].r, ruta(ana, "b")));
  await como(uSocio, async () => {
    const [{ r }] = await t.q(`select public.profes_de_clases($1) as r`, [[clase]]);
    assert.equal(r.length, 1);
    assert.equal(r[0].nombre, "Ana");
    assert.equal(r[0].tiene_foto, true);
    assert.equal(r[0].clase_id, clase);
  });
  const [{ r: pub }] = await t.q(`select privado.landing_completa($1) -> 'equipo_publico' as r`, [t.g]);
  assert.equal(pub.length, 1);
  assert.equal(pub[0].nombre, "Ana");
  assert.deepEqual(pub[0].actividades, ["Spinning"]);
  assert.ok(!JSON.stringify(pub).includes("09:00"), "el horario de trabajo no sale afuera");

  // Una persona sin tildar sigue oculta aunque la opción esté prendida.
  const juan = (await t.q(`select id from public.equipo where nombre = 'Juan' and gimnasio_id = $1`, [t.g]))[0].id;
  await t.q(`insert into public.equipo_perfil (gimnasio_id, equipo_id, foto_path, mostrar) values ($1,$2,$3,false)`, [t.g, juan, ruta(juan)]);
  await comoAnon(async () => assert.equal((await t.q(`select public.foto_equipo($1) as r`, [juan]))[0].r, null));
  // El equipo sí la ve siempre.
  await como(uRec, async () => assert.equal((await t.q(`select public.foto_equipo($1) as r`, [juan]))[0].r, ruta(juan)));

  // Destildarla la oculta al instante.
  await como(uDueno, () => t.q(`select public.guardar_perfil_equipo($1,$2,false,$3,'[]')`, [t.g, ana, [act]]));
  await comoAnon(async () => assert.equal((await t.q(`select public.foto_equipo($1) as r`, [ana]))[0].r, null));
  await como(uSocio, async () => assert.deepEqual((await t.q(`select public.profes_de_clases($1) as r`, [[clase]]))[0].r, []));
});

test("las funciones de escritura no las ejecuta anon", async () => {
  await comoAnon(() => t.falla(() => t.q(`select public.guardar_equipo_ajuste($1,true)`, [t.g]), /permission denied/));
  await comoAnon(() => t.falla(() => t.q(`select public.profes_de_clases($1)`, [[clase]]), /permission denied/));
});
