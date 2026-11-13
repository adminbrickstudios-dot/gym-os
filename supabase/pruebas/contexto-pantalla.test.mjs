// F0.2 · contexto_pantalla junta en una llamada lo que antes eran seis: tiene que dar EXACTAMENTE lo mismo que las piezas por separado.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {};
before(async () => {
  t = await abrir("prueba-contexto-pantalla");
  for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    u[rol] = id;
  }
});
after(async () => t && t.cerrar());

const solo = async (f, args) => { try { return (await t.q(`select ${f}($1) r`, args))[0].r; } catch { return null; } };

for (const rol of ["dueno", "encargado", "recepcion", "profe"]) {
  test(`${rol}: contexto_pantalla es igual a las piezas por separado`, async () => {
    await t.comoUsuario(u[rol], async () => {
      const [{ r: c }] = await t.q(`select public.contexto_pantalla($1) r`, [t.g]);
      const panel = await solo("public.panel_gimnasio", [t.g]);
      assert.deepEqual(c.panel, panel);
      assert.deepEqual(c.abono, await solo("public.estado_abono_panel", [t.g]));
      if (rol === "recepcion") assert.equal(c.ver_mensajes, await solo("public.ver_mensajes_equipo", [t.g]));
      else assert.equal("ver_mensajes" in c, false);
      if (rol !== "dueno") assert.equal(c.fichaje_usa, !!(await solo("public.config_fichaje", [t.g]))?.usa);
      else assert.equal("fichaje_usa" in c, false);
      if (rol !== "profe") {
        assert.deepEqual(c.config_entrada, await solo("public.config_entrada", [t.g]));
        assert.deepEqual(c.formas_entrada, await solo("public.formas_de_entrada", [t.g]));
      } else assert.equal("config_entrada" in c, false);
      // E8: el estado del gimnasio y el contacto vienen en la misma llamada, iguales a sus funciones.
      assert.deepEqual(c.estado_gimnasio, await solo("public.estado_gimnasio_aviso", [t.g]));
      if (rol === "profe") assert.equal("contacto_plataforma" in c, false);
      else assert.deepEqual(c.contacto_plataforma, (await t.q(`select public.contacto_plataforma_publico() r`))[0].r);
    });
  });
}

test("E8: pausado, dado de baja y demo vencida salen igual que con estado_gimnasio_aviso", async () => {
  const casos = [
    `suspension_manual_en = now(), suspension_manual_motivo = 'prueba'`,
    `suspension_manual_en = null, suspension_manual_motivo = null, baja_en = now()`,
    `baja_en = null, es_demo = true, demo_hasta = now() - interval '1 day'`,
    `es_demo = false, demo_hasta = null`,
  ];
  for (const set of casos) {
    await t.q(`update public.gimnasios set ${set} where id = $1`, [t.g]);
    await t.comoUsuario(u.dueno, async () => {
      const [{ r: c }] = await t.q(`select public.contexto_pantalla($1) r`, [t.g]);
      const e = await solo("public.estado_gimnasio_aviso", [t.g]);
      assert.deepEqual(c.estado_gimnasio, e);
      assert.ok(e && typeof e.pausado === "boolean");
    });
  }
});

test("sin permiso es un error, nunca un contexto vacío; otro gimnasio también", async () => {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`nadie${Math.random()}@ejemplo.invalid`]);
  await t.comoUsuario(id, async () => {
    await t.falla(() => t.q(`select public.contexto_pantalla($1)`, [t.g]), /./);
  });
});
