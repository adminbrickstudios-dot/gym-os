// Retención: cada socio en la lista que le corresponde, con el porqué y el mensaje armado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, momento, filas;
const D = (n) => sumarDias(HOY, n);
const fila = (socio) => filas.find((f) => f.socio_id === socio);
const recalcular = async () => { filas = await t.q(`select * from privado.retencion($1, $2)`, [t.g, momento]); };

async function socioCon(apellido, { inicio = -200, cobs = [], visitas = [] } = {}) {
  const [{ id: s }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Lucía',$2,'+5490000999001') returning id`, [t.g, apellido]);
  const [{ id: su }] = await t.q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
      values ($1,$2,$3,privado.medianoche($4::date,$5)) returning id`, [t.g, s, t.ctx.planes.full, D(inicio), t.ctx.zona]);
  for (const [d, h] of cobs)
    await t.q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
               values ($1,$2,$3,privado.medianoche($4::date,$6),privado.medianoche($5::date,$6),'cortesia','prueba')`,
      [t.g, su, s, D(d), D(h), t.ctx.zona]);
  for (const d of visitas)
    await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
               values ($1,$2,$3,privado.medianoche($4::date,$5)+interval '19 hours','recepcion','entro','membresia','verde','al_dia','x')`,
      [t.g, t.sede, s, D(d), t.ctx.zona]);
  return s;
}

before(async () => {
  t = await abrir("prueba-retencion");
  momento = await t.en(HOY);
  await recalcular();
});
after(async () => t && t.cerrar());

test("vencidos, por vencer y no vienen, con el porqué", async () => {
  assert.equal(fila(t.ctx.socios.vencida).lista, "vencido");
  assert.equal(fila(t.ctx.socios.vencida).texto, "Venció el 24/10 · debe $25.000");
  assert.equal(Number(fila(t.ctx.socios.vencida).debe), 25000);
  assert.equal(fila(t.ctx.socios.por_vencer).lista, "por_vencer");
  assert.equal(fila(t.ctx.socios.por_vencer).texto, "Vence el 16/11");
  assert.equal(fila(t.ctx.socios.vence_hoy).texto, "Vence hoy");
  assert.equal(fila(t.ctx.socios.al_dia).lista, "no_viene");
  assert.match(fila(t.ctx.socios.al_dia).texto, /^No vino nunca/);
});

test("dejó de pagar hace más de 30 días: se fue", async () => {
  assert.equal(fila(t.ctx.socios.vencida_tres_meses).lista, "se_fue");
  assert.equal(fila(t.ctx.socios.vencida_tres_meses).texto, "Dejó de pagar el 19/08");
});

test("congelados y suspendidos no están en riesgo", async () => {
  assert.equal(fila(t.ctx.socios.congelada), undefined);
  assert.equal(fila(t.ctx.socios.suspendido), undefined);
});

test("quien pagó un período que todavía no arranca no figura como vencido", async () => {
  const s = await socioCon("Adelantado", { cobs: [[-40, -10], [2, 32]], visitas: [-1] });
  await recalcular();
  assert.equal(fila(s), undefined);
});

test("la frecuencia de antes aparece: 'venía 3 veces por semana'", async () => {
  const visitas = [];
  for (let d = -70; d <= -20; d++) if ([0, 2, 4].includes(((d % 7) + 7) % 7)) visitas.push(d);
  const s = await socioCon("Frecuente", { cobs: [[-80, 15]], visitas });
  await recalcular();
  assert.equal(fila(s).lista, "no_viene");
  assert.match(fila(s).texto, /^No viene hace 2\d días · venía 3 veces por semana$/);
});

test("socio nuevo que faltó la última semana: lista de nuevos", async () => {
  const s = await socioCon("Nueva", { inicio: -12, cobs: [[-12, 18]], visitas: [-11] });
  await recalcular();
  assert.equal(fila(s).lista, "nuevo");
  assert.match(fila(s).texto, /^Se anotó el 02\/11 · no viene hace 11 días$/);
});

test("al día y viniendo: no aparece", async () => {
  const s = await socioCon("Constante", { cobs: [[-20, 20]], visitas: [-3, -1] });
  await recalcular();
  assert.equal(fila(s), undefined);
});

test("baja formal: se fue, con el motivo", async () => {
  const s = await socioCon("Baja", { cobs: [[-20, 20]], visitas: [-5] });
  await t.q(`select privado.dar_de_baja($1, 'precio', $2)`, [s, await t.en(D(-2))]);
  await recalcular();
  assert.equal(fila(s).lista, "se_fue");
  assert.equal(fila(s).texto, "Se dio de baja el 12/11 · precio");
});

test("el mensaje viene armado con los datos del socio y del gimnasio", async () => {
  const f = fila(t.ctx.socios.vencida);
  assert.equal(f.mensaje, "Hola Testigo! Tu plan en Gimnasio de Prueba venció el 24/10. Para seguir entrenando son $25.000. ¿Te esperamos esta semana?");
  for (const x of filas) assert.ok(!/\{\w+\}/.test(x.mensaje ?? ""), `quedó una variable sin reemplazar: ${x.mensaje}`);
  await t.q(`update public.plantillas_mensaje set texto = 'Che {nombre}, vence el {vence}' where gimnasio_id = $1 and clave = 'por_vencer'`, [t.g]);
  await recalcular();
  assert.equal(fila(t.ctx.socios.por_vencer).mensaje, "Che Testigo, vence el 16/11");
});

test("plata en riesgo = suma mensual de vencidos, por vencer, nuevos y no vienen", async () => {
  const [{ r }] = await t.q(`select privado.retencion_resumen($1, $2) as r`, [t.g, momento]);
  const esperado = filas.filter((f) => f.lista !== "se_fue").reduce((a, f) => a + Number(f.monto_mensual), 0);
  assert.equal(Number(r.plata_en_riesgo), esperado);
  assert.equal(r.listas.vencido, filas.filter((f) => f.lista === "vencido").length);
});

test("ya le escribió alguien: aparece quién y cuándo; la recepción no ve la retención", async () => {
  const [{ id: uDue }] = await t.q(`insert into auth.users (email) values ('due-ret@ejemplo.invalid') returning id`);
  const [{ id: uRec }] = await t.q(`insert into auth.users (email) values ('rec-ret@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Caro','dueno'), ($1,$3,'Rec','recepcion')`, [t.g, uDue, uRec]);
  await t.db.query("savepoint c");
  await t.q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uDue, role: "authenticated" })]);
  await t.db.query("set local role authenticated");
  await t.q(`select public.registrar_contacto($1, 'vencido')`, [t.ctx.socios.vencida]);
  await t.db.query("reset role");
  await recalcular();
  await t.db.query("rollback to savepoint c");
  assert.equal(fila(t.ctx.socios.vencida).ultimo_contacto_por, "Caro");
  await t.comoUsuario(uRec, () => t.falla(() => t.q(`select * from public.retencion($1)`, [t.g]), /Sin permiso/));
});
