// FA-22 (migración 202611090409): alertas por patrón. Solo avisan al dueño y al encargado; no frenan nada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, dueno, recepcion, sede2, socio;
before(async () => {
  t = await abrir("prueba-alertas-patron");
  for (const rol of ["dueno", "recepcion"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    if (rol === "dueno") dueno = id; else recepcion = id;
  }
  [{ id: sede2 }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1,'Sede Norte') returning id`, [t.g]);
  [{ id: socio }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Doble','Entrada','+5490000444001') returning id`, [t.g]);
});
after(async () => t && t.cerrar());
const entrada = (sede, minutosAtras) => t.q(
  `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
   values ($1,$2,$3, now() - $4::interval, 'recepcion', 'entro', 'verde', 'vigente', 'ok')`, [t.g, sede, socio, `${minutosAtras} minutes`]);

test("el mismo socio en dos sedes con pocos minutos de diferencia; en la misma sede o con mucha diferencia, no", async () => {
  await entrada(t.sede, 60); await entrada(t.sede, 55);          // misma sede: nada
  await entrada(t.sede, 300); await entrada(sede2, 100);         // 200 minutos: nada
  await t.comoUsuario(dueno, async () => {
    const [{ r }] = await t.q(`select public.alertas_patron_entradas($1) r`, [t.g]);
    assert.equal(r.dos_sedes.length, 0);
  });
  await entrada(sede2, 50);                                       // 5 minutos después de la de la sede 1 (55 atrás → 50 atrás)
  await t.comoUsuario(dueno, async () => {
    const [{ r }] = await t.q(`select public.alertas_patron_entradas($1) r`, [t.g]);
    assert.equal(r.dos_sedes.length, 1);
    assert.equal(r.dos_sedes[0].nombre, "Doble Entrada");
    assert.ok(r.dos_sedes[0].minutos <= 20);
  });
});

test("muchas entradas en un día, muy por encima de su promedio; la recepción no lo ve", async () => {
  const [{ id: otro }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,'Muchas','Veces','+5490000444002') returning id`, [t.g]);
  const ent = (min) => t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto) values ($1,$2,$3, now() - ($4 * interval '1 second'), 'recepcion', 'entro', 'verde', 'vigente', 'ok')`, [t.g, t.sede, otro, `${min} minutes`]);
  for (const m of [10, 40, 70, 100]) await ent(m);
  await t.comoUsuario(dueno, async () => {
    const [{ r }] = await t.q(`select public.alertas_patron_entradas($1) r`, [t.g]);
    const m = r.muchas_entradas.filter((x) => x.nombre === "Muchas Veces");
    assert.equal(m.length >= 1, true);
    assert.equal(m[0].entradas >= 4, true);
    await t.falla(() => t.q(`select public.alertas_patron_entradas($1, 0)`, [t.g]), /1 a 90/);
  });
  await t.comoUsuario(recepcion, () => t.falla(() => t.q(`select public.alertas_patron_entradas($1)`, [t.g]), /Sin permiso/));
});
