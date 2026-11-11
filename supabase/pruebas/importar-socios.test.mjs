// Importar socios (migración 0034): revisar marca cada error con su fila,
// importar entra lo válido junto, "vence el" es una cobertura (el socio entra
// hasta ese día), 3.000 filas en menos de 30 s, deshacer dentro de 24 h (no si
// ya hay movimientos), y los hechos siguen sin poder borrarse fuera de eso.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, plan;
async function persona(rol) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
  return id;
}
before(async () => {
  t = await abrir("prueba-importar");
  for (const r of ["dueno", "recepcion"]) u[r] = await persona(r);
  [{ nombre: plan }] = await t.q(`select nombre from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo order by orden limit 1`, [t.g]);
});
after(async () => t && t.cerrar());

const enDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

test("revisar: cada error con su fila, sin guardar nada", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const filas = [
      { nombre: "Ana Gómez", dni: "20.111.222", telefono: "387 15 555-0001", plan: plan.toUpperCase(), vence: enDias(10) },
      { nombre: "", dni: "123" },
      { nombre: "Beto", dni: "20111222", telefono: "abc", plan: "Plan Inventado", vence: "31/31/2026" },
      { nombre: "Caro", email: "caro@", nacimiento: "1990-02-30" },
    ];
    const r = (await t.q(`select public.revisar_importacion($1, $2) as r`, [t.g, JSON.stringify(filas)]))[0].r;
    assert.equal(r.validas, 1);
    assert.deepEqual(r.filas[0].errores, []);
    assert.equal(r.filas[0].datos.apellido, "Gómez", "nombre y apellido en una columna se separan");
    assert.equal(r.filas[0].datos.telefono, "+5493875550001");
    assert.ok(r.filas[1].errores.includes("Falta el nombre"));
    const e2 = r.filas[2].errores.join(" | ");
    assert.match(e2, /DNI 20111222: repetido en el archivo/);
    assert.match(e2, /Celular “abc”/);
    assert.match(e2, /Plan “Plan Inventado”: no existe/);
    assert.match(e2, /Pagó hasta “31\/31\/2026”/);
    assert.match(r.filas[3].errores.join(" | "), /Mail “caro@”/);
    const [{ n }] = await t.q(`select count(*)::int n from public.socios where gimnasio_id = $1 and origen = 'importacion'`, [t.g]);
    assert.equal(n, 0);
  });
});

test("importar lo válido; vence el es una cobertura; deshacer dentro de 24 h", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const filas = [
      { nombre: "Dani", apellido: "Importado", dni: "30222333", telefono: "011 1234-5601", plan, vence: enDias(5) },
      { nombre: "Eva", apellido: "Importada", dni: "30222334", plan, vence: enDias(-3) },
      { nombre: "", dni: "1" },
    ];
    const r = (await t.q(`select public.importar_socios($1, $2, 'socios.xlsx') as r`, [t.g, JSON.stringify(filas)]))[0].r;
    assert.equal(r.importados, 2);
    assert.equal(r.salteados, 1);
    const [dani] = await t.q(`select id from public.socios where gimnasio_id = $1 and dni = '30222333'`, [t.g]);
    const [eva] = await t.q(`select id from public.socios where gimnasio_id = $1 and dni = '30222334'`, [t.g]);
    assert.equal((await t.q(`select (public.estado_acceso($1)).color as c`, [dani.id]))[0].c === "rojo", false, "pagó hasta dentro de 5 días: entra");
    assert.notEqual((await t.q(`select (public.estado_acceso($1)).color as c`, [eva.id]))[0].c, "verde", "le venció hace 3 días: no entra al día");
    const [{ o }] = await t.q(`select origen as o from public.coberturas where socio_id = $1`, [dani.id]);
    assert.equal(o, "importacion");
    const lista = (await t.q(`select public.importaciones_panel($1) as l`, [t.g]))[0].l;
    assert.equal(lista[0].puede_deshacer, true);
    const borrados = (await t.q(`select public.deshacer_importacion($1, $2) as n`, [t.g, r.importacion_id]))[0].n;
    assert.equal(borrados, 2);
    const [{ n }] = await t.q(`select count(*)::int n from public.socios where gimnasio_id = $1 and dni in ('30222333', '30222334')`, [t.g]);
    assert.equal(n, 0, "deshacer borra a los importados (se pueden volver a importar)");
    await t.falla(() => t.q(`select public.deshacer_importacion($1, $2)`, [t.g, r.importacion_id]), /ya se deshizo/);
    // Los hechos siguen sin borrarse fuera de deshacer.
    const borradas = await t.q(`delete from public.coberturas where gimnasio_id = $1 returning id`, [t.g]);
    assert.equal(borradas.length, 0, "desde el cliente no se borra ninguna cobertura");
  });
});

test("no se deshace si ya hay movimientos; recepción no importa", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const r = (await t.q(`select public.importar_socios($1, $2) as r`, [t.g, JSON.stringify([{ nombre: "Fede", dni: "30222335", plan, vence: enDias(20) }])]))[0].r;
    const [fede] = await t.q(`select id from public.socios where gimnasio_id = $1 and dni = '30222335'`, [t.g]);
    // Una entrada de verdad (como la registra la recepción).
    await t.q(`select public.registrar_ingreso($1, $2)`, [fede.id, t.sede]);
    const [{ n }] = await t.q(`select count(*)::int n from public.ingresos where socio_id = $1`, [fede.id]);
    if (n > 0) await t.falla(() => t.q(`select public.deshacer_importacion($1, $2)`, [t.g, r.importacion_id]), /ya tienen movimientos/);
  });
  await t.comoUsuario(u.recepcion, async () => t.falla(() => t.q(`select public.revisar_importacion($1, '[{"nombre":"x"}]')`, [t.g]), /Sin permiso/));
});

test("3.000 filas en menos de 30 segundos", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const filas = Array.from({ length: 3000 }, (_, i) => ({ nombre: `Masivo${i}`, apellido: "Prueba", dni: String(40000000 + i),
      telefono: `000 ${String(1000000 + i).slice(-7)}`, plan, vence: enDias(15) }));
    const t0 = Date.now();
    const r = (await t.q(`select public.importar_socios($1, $2) as r`, [t.g, JSON.stringify(filas)]))[0].r;
    const s = (Date.now() - t0) / 1000;
    assert.equal(r.importados, 3000);
    assert.ok(s < 30, `tardó ${s} s`);
    console.log(`# 3.000 socios importados en ${s.toFixed(1)} s`);
  });
});
