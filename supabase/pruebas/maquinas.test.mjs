// VD-54 (5400): mantenimiento de máquinas. Cualquiera del equipo reporta; sólo el dueño y el encargado dan de alta,
// asignan, cierran y dan de baja. El estado se calcula (falla abierta = fuera de servicio) y la historia no se borra.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, uDueno, uEnc, uProfe, uRec, eProfe, maq;
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-maquinas");
  for (const [rol, nombre] of [["dueno", "Dueña"], ["encargado", "Enco"], ["profe", "Prof"], ["recepcion", "Sofi"]]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    const [{ id: eid }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4) returning id`, [t.g, id, nombre, rol]);
    if (rol === "dueno") uDueno = id; else if (rol === "encargado") { uEnc = id; } else if (rol === "profe") { uProfe = id; eProfe = eid; } else uRec = id;
  }
  [{ id: maq }] = await como(uDueno, () => t.q(`select public.crear_maquina($1, $2, 'Prensa 45°') as id`, [t.g, t.sede]));
});
after(async () => t && t.cerrar());

const estado = async (u = uDueno) => (await como(u, () => t.q(`select public.maquinas_panel($1) as r`, [t.g])))[0].r;

test("sólo el dueño y el encargado dan de alta máquinas; el nombre no se repite en la sede", async () => {
  await como(uRec, () => t.falla(() => t.q(`select public.crear_maquina($1, $2, 'Remo')`, [t.g, t.sede]), /Sin permiso/));
  await como(uProfe, () => t.falla(() => t.q(`select public.crear_maquina($1, $2, 'Remo')`, [t.g, t.sede]), /Sin permiso/));
  await como(uEnc, () => t.q(`select public.crear_maquina($1, $2, 'Remo')`, [t.g, t.sede]));
  await como(uDueno, () => t.falla(() => t.q(`select public.crear_maquina($1, $2, 'remo')`, [t.g, t.sede]), /Ya hay una máquina/));
  await como(uDueno, () => t.falla(() => t.q(`select public.crear_maquina($1, $2, '  ')`, [t.g, t.sede]), /nombre/));
});

test("la recepción reporta una falla: queda fuera de servicio, con quién y cuándo; no se reporta dos veces", async () => {
  const [{ id }] = await como(uRec, () => t.q(`select public.reportar_falla($1, 'Se corta el cable y no sube el peso') as id`, [maq]));
  const p = await estado(uRec);
  const m = p.maquinas.find((x) => x.maquina_id === maq);
  assert.equal(m.estado, "fuera_de_servicio");
  assert.equal(m.falla.falla_id, id);
  assert.equal(m.falla.reportada_por, "Sofi");
  assert.equal(p.puede_gestionar, false);
  await como(uProfe, () => t.falla(() => t.q(`select public.reportar_falla($1, 'Otra vez rota')`, [maq]), /ya está marcada/));
  const fuera = (await como(uRec, () => t.q(`select public.maquinas_fuera_de_servicio($1) as r`, [t.g])))[0].r;
  assert.equal(fuera.length, 1);
  assert.match(fuera[0].frase, /Prensa 45°.*fuera de servicio/);
});

test("el motivo es obligatorio y el responsable lo pone sólo la gestión", async () => {
  const [{ id: otra }] = await como(uDueno, () => t.q(`select public.crear_maquina($1, $2, 'Polea') as id`, [t.g, t.sede]));
  await como(uProfe, () => t.falla(() => t.q(`select public.reportar_falla($1, 'x')`, [otra]), /Contá qué le pasa/));
  await como(uProfe, () => t.falla(() => t.q(`select public.reportar_falla($1, 'Chirría mucho', $2)`, [otra, eProfe]), /lo elige el dueño/));
  await como(uEnc, () => t.q(`select public.reportar_falla($1, 'Chirría mucho', $2)`, [otra, eProfe]));
  const m = (await estado(uDueno)).maquinas.find((x) => x.maquina_id === otra);
  assert.equal(m.falla.responsable, "Prof");
});

test("asignar responsable y cerrar la falla: sólo gestión; queda en servicio con fecha y quién", async () => {
  const f = (await estado(uDueno)).maquinas.find((x) => x.maquina_id === maq).falla.falla_id;
  await como(uRec, () => t.falla(() => t.q(`select public.asignar_responsable_falla($1, $2)`, [f, eProfe]), /Sin permiso/));
  await como(uProfe, () => t.falla(() => t.q(`select public.arreglar_falla($1, 'listo')`, [f]), /Sin permiso/));
  await como(uDueno, () => t.q(`select public.asignar_responsable_falla($1, $2)`, [f, eProfe]));
  const [{ id: uBaja }] = await t.q(`insert into auth.users (email) values ('baja@ejemplo.invalid') returning id`);
  const [{ id: eBaja }] = await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, activo) values ($1, $2, 'Inactivo', 'recepcion', false) returning id`, [t.g, uBaja]);
  await como(uDueno, () => t.falla(() => t.q(`select public.asignar_responsable_falla($1, $2)`, [f, eBaja]), /no es del equipo/));
  await como(uEnc, () => t.q(`select public.arreglar_falla($1, 'Se cambió el cable')`, [f]));
  const m = (await estado(uDueno)).maquinas.find((x) => x.maquina_id === maq);
  assert.equal(m.estado, "en_servicio");
  assert.equal(m.falla, null);
  assert.equal(m.cantidad_fallas, 1);
  const h = (await como(uRec, () => t.q(`select public.historial_maquina($1) as r`, [maq])))[0].r;
  assert.equal(h.fallas[0].arreglada_por, "Enco");
  assert.equal(h.fallas[0].nota_arreglo, "Se cambió el cable");
  assert.equal(h.fallas[0].responsable, "Prof");
  await como(uDueno, () => t.falla(() => t.q(`select public.arreglar_falla($1)`, [f]), /ya estaba arreglada/));
});

test("el historial es inmutable aunque se vaya directo a la tabla; y una máquina vuelve a fallar", async () => {
  const [{ id: f }] = await t.q(`select id from public.maquina_fallas where maquina_id = $1`, [maq]);
  await t.falla(() => t.q(`delete from public.maquina_fallas where id = $1`, [f]), /no se borran/);
  await t.falla(() => t.q(`update public.maquina_fallas set motivo = 'otra cosa' where id = $1`, [f]), /no se cambia la máquina, el motivo/);
  await t.falla(() => t.q(`update public.maquina_fallas set nota_arreglo = 'cambio' where id = $1`, [f]), /ya está arreglada/);
  await como(uProfe, () => t.q(`select public.reportar_falla($1, 'Volvió a trabarse') as id`, [maq]));
  const h = (await como(uDueno, () => t.q(`select public.historial_maquina($1) as r`, [maq])))[0].r;
  assert.equal(h.fallas.length, 2);
});

test("la foto: la ruta la arma la base, sólo quien reportó o la gestión; una sola vez", async () => {
  const [{ id: f }] = await t.q(`select id from public.maquina_fallas where maquina_id = $1 and arreglada_en is null`, [maq]);
  const [{ r: ruta }] = await como(uProfe, () => t.q(`select public.preparar_foto_falla($1, 'jpg') as r`, [f]));
  assert.match(ruta, new RegExp(`^${t.g}/${maq}/falla-[0-9a-f]{32}\\.jpg$`));
  await como(uRec, () => t.falla(() => t.q(`select public.preparar_foto_falla($1, 'jpg')`, [f]), /quien reportó/));
  await como(uProfe, () => t.falla(() => t.q(`select public.preparar_foto_falla($1, 'gif')`, [f]), /JPG, PNG o WEBP/));
  await como(uProfe, () => t.falla(() => t.q(`select public.confirmar_foto_falla($1, 'cualquier/cosa.jpg')`, [f]), /Ruta de foto inválida/));
  await como(uProfe, () => t.q(`select public.confirmar_foto_falla($1, $2)`, [f, ruta]));
  await como(uRec, () => t.q(`select public.foto_falla($1)`, [f]));
  assert.equal((await como(uRec, () => t.q(`select public.foto_falla($1) as r`, [f])))[0].r, ruta);
  await como(uProfe, () => t.falla(() => t.q(`select public.preparar_foto_falla($1, 'jpg')`, [f]), /ya tiene su foto/));
});

test("no se da de baja una máquina fuera de servicio; de baja no se puede reportar", async () => {
  await como(uDueno, () => t.falla(() => t.q(`select public.dar_de_baja_maquina($1, false)`, [maq]), /cerrá la falla/));
  const [{ id: f }] = await t.q(`select id from public.maquina_fallas where maquina_id = $1 and arreglada_en is null`, [maq]);
  await como(uDueno, () => t.q(`select public.arreglar_falla($1, null)`, [f]));
  await como(uRec, () => t.falla(() => t.q(`select public.dar_de_baja_maquina($1, false)`, [maq]), /Sin permiso/));
  await como(uDueno, () => t.q(`select public.dar_de_baja_maquina($1, false)`, [maq]));
  await como(uProfe, () => t.falla(() => t.q(`select public.reportar_falla($1, 'Rota otra vez')`, [maq]), /dada de baja/));
});

test("otro gimnasio y la sección apagada: error, no lista vacía", async () => {
  const [{ id: forastero }] = await t.q(`insert into auth.users (email) values ('fuera@ejemplo.invalid') returning id`);
  await como(forastero, () => t.falla(() => t.q(`select public.maquinas_panel($1)`, [t.g]), /Sin permiso/));
  await como(forastero, () => t.falla(() => t.q(`select public.maquinas_fuera_de_servicio($1)`, [t.g]), /Sin permiso/));
  await t.q(`update public.configuracion_gimnasio set secciones_apagadas = array['maquinas'] where gimnasio_id = $1`, [t.g]);
  await como(uDueno, () => t.falla(() => t.q(`select public.maquinas_panel($1)`, [t.g]), /apagado/));
  await como(uRec, () => t.falla(() => t.q(`select public.reportar_falla($1, 'Rota')`, [maq]), /apagado/));
  // El cuadro del Inicio no rompe: con la sección apagada no hay nada que mostrar.
  const fuera = (await como(uDueno, () => t.q(`select public.maquinas_fuera_de_servicio($1) as r`, [t.g])))[0].r;
  assert.deepEqual(fuera, []);
});
