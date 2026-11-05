// Mensajes editables (migración 0025): un cambio de plantilla se ve en
// Retención (y en Vencen hoy, que sale de la misma cuenta).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, u = {};
async function persona(rol) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, usuario, `Persona ${rol}`, rol]);
  return usuario;
}
before(async () => {
  t = await abrir("prueba-mensajes");
  for (const rol of ["dueno", "encargado", "recepcion"]) u[rol] = await persona(rol);
});
after(async () => t && t.cerrar());

const lista = async () => (await t.q(`select public.mensajes_panel($1) as m`, [t.g]))[0].m;
const retencion = async () => t.q(`select * from privado.retencion($1, $2)`, [t.g, await t.en(HOY, "12:00:00")]);

test("los 11 mensajes, con su texto original y dónde se usan", async () => {
  await t.comoUsuario(u.encargado, async () => {
    const m = await lista();
    assert.deepEqual(m.map((x) => x.clave), ["por_vencer", "vencido", "no_viene", "nuevo", "se_fue", "bienvenida", "cumpleanos", "comprobante_rechazado", "prospecto", "comprobante_pago", "clase_cancelada"]);
    assert.ok(m.every((x) => x.texto === x.original && x.modificado === false));
    assert.deepEqual(m.find((x) => x.clave === "por_vencer").usado_en, ["Retención", "Vencen hoy"]);
  });
});

test("un cambio de plantilla se ve en Retención, con {plan} y {debe}", async () => {
  const antes = (await retencion()).find((r) => r.lista === "por_vencer");
  assert.ok(antes, "los casos testigo tienen a alguien por vencer");
  assert.match(antes.mensaje, /vence el/);
  // Guardar con sesión y leer la retención en la misma transacción (fuera de comoUsuario se revierte).
  await t.q(`update public.plantillas_mensaje set texto = 'Che {nombre}, tu {plan} vence el {vence}: son {debe}.' where gimnasio_id = $1 and clave = 'por_vencer'`, [t.g]);
  const despues = (await retencion()).find((r) => r.socio_id === antes.socio_id);
  assert.match(despues.mensaje, /^Che \S+, tu .+ vence el \d+\/\d+: son \$[\d.]+\.$/);
  assert.doesNotMatch(despues.mensaje, /[{}]/);
});

test("guardar valida: vacío, largo y variables que ese mensaje no tiene", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => t.q(`select public.guardar_mensaje($1, 'cumpleanos', '   ')`, [t.g]), /no puede quedar vacío/);
    await t.falla(() => t.q(`select public.guardar_mensaje($1, 'cumpleanos', $2)`, [t.g, "x".repeat(1001)]), /hasta 1000 letras/);
    await t.falla(() => t.q(`select public.guardar_mensaje($1, 'cumpleanos', 'Feliz {nombre}, debés {debe} {cosa}')`, [t.g]),
      /no se puede usar \{cosa\}, \{debe\}\. Podés usar: \{nombre\} \{gimnasio\}/);
    await t.falla(() => t.q(`select public.guardar_mensaje($1, 'inventado', 'Hola')`, [t.g]), /desconocido/);
    await t.q(`select public.guardar_mensaje($1, 'cumpleanos', '  Feliz cumple {nombre} 🎂  ')`, [t.g]);
    let c = (await lista()).find((x) => x.clave === "cumpleanos");
    assert.equal(c.texto, "Feliz cumple {nombre} 🎂");
    assert.equal(c.modificado, true);
    const [{ r }] = await t.q(`select public.restaurar_mensaje($1, 'cumpleanos') as r`, [t.g]);
    c = (await lista()).find((x) => x.clave === "cumpleanos");
    assert.equal(c.texto, r);
    assert.equal(c.modificado, false);
  });
});

test("vista previa con un socio real, sin guardar nada", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const antes = await lista();
    for (const clave of ["por_vencer", "bienvenida", "comprobante_rechazado"]) {
      const [{ v }] = await t.q(`select public.vista_previa_mensaje($1, $2, 'Hola {nombre} de {gimnasio}') as v`, [t.g, clave]);
      assert.ok(v.socio, `${clave}: con un socio`);
      assert.match(v.texto, /^Hola \S+ de Gimnasio de Prueba$/);
    }
    await t.falla(() => t.q(`select public.vista_previa_mensaje($1, 'no_viene', 'Debés {debe}')`, [t.g]), /no se puede usar \{debe\}/);
    assert.deepEqual(await lista(), antes, "la vista previa no guarda");
  });
});

test("permisos: recepción no ve ni cambia los mensajes", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    await t.falla(() => lista(), /Sin permiso/);
    await t.falla(() => t.q(`select public.guardar_mensaje($1, 'cumpleanos', 'Hola')`, [t.g]), /Sin permiso/);
  });
});
