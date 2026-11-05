// Filtros de Socios (0045): cada píldora cuenta lo mismo que lista, y cada
// fila listada es del grupo que dice la puerta (calcular_acceso).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, recepcion;
before(async () => {
  t = await abrir("prueba-filtros");
  [{ id: recepcion }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`recepcion${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Rece','recepcion')`, [t.g, recepcion]);
});
after(async () => t && t.cerrar());

test("las cuentas suman y coinciden con la lista; cada fila es de su grupo", async () => {
  await t.comoUsuario(recepcion, async () => {
    const [{ f }] = await t.q(`select public.filtros_socios($1) as f`, [t.g]);
    const grupos = ["al_dia", "por_vencer", "vencidos", "en_pausa", "sin_plan"];
    assert.equal(grupos.reduce((a, g) => a + f[g], 0), f.todos, "los grupos suman el total");
    assert.ok(f.todos > 0);
    for (const g of [...grupos, "nuevos", "bajas"]) {
      const filas = await t.q(`select * from public.buscar_socios($1, '', 100, null, $2)`, [t.g, g]);
      assert.equal(filas.length, Math.min(f[g], 100), `${g}: la lista y la cuenta`);
      if (g === "bajas") assert.ok(filas.every((x) => x.dado_de_baja));
      else assert.ok(filas.every((x) => !x.dado_de_baja), `${g}: sin dados de baja`);
      if (g === "al_dia") assert.ok(filas.every((x) => x.color === "verde"));
      if (g === "vencidos") assert.ok(filas.every((x) => x.color === "rojo" && !/Congelada/.test(x.texto)));
    }
    for (const p of f.planes) {
      const filas = await t.q(`select * from public.buscar_socios($1, '', 100, null, null, $2)`, [t.g, p.plan_id]);
      assert.equal(filas.length, Math.min(p.socios, 100), `plan ${p.nombre}`);
      assert.ok(filas.every((x) => x.plan === p.nombre));
    }
    await t.falla(() => t.q(`select * from public.buscar_socios($1, '', 10, null, 'cualquiera')`, [t.g]), /Filtro desconocido/);
  });
  const [{ n }] = await t.q(`select count(*)::int n from pg_proc where proname = 'buscar_socios'`);
  assert.equal(n, 1, "una sola buscar_socios");
});
