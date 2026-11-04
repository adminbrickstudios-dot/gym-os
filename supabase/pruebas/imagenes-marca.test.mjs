// Logo, ícono y fotos del gimnasio (migración 0022). Cada función se llama
// con el rol de la persona logueada. La base local no tiene Storage: acá se
// prueba lo que decide la base (permisos, tipos, tamaños, rutas, cupo).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, otro, u = {};

async function persona(rol, gimnasio = null) {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio ?? t.g, usuario, `Persona ${rol}`, rol]);
  return usuario;
}

before(async () => {
  t = await abrir("prueba-imagenes");
  [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-imagenes-otro', 'Otro') returning id`);
  for (const rol of ["dueno", "encargado"]) u[rol] = await persona(rol);
  u.ajeno = await persona("dueno", otro);
});
after(async () => t && t.cerrar());

const preparar = async (tipo, mime, bytes, g = t.g) =>
  (await t.q(`select public.preparar_imagen_marca($1, $2, $3, $4) as r`, [g, tipo, mime, bytes]))[0].r;
const confirmar = async (tipo, ruta, g = t.g) => (await t.q(`select public.confirmar_imagen_marca($1, $2, $3) as r`, [g, tipo, ruta]))[0].r;
const quitar = async (tipo, ruta = null) => (await t.q(`select public.quitar_imagen_marca($1, $2, $3) as r`, [t.g, tipo, ruta]))[0].r;
const datos = async () => (await t.q(`select public.datos_gimnasio_panel($1) as d`, [t.g]))[0].d;

test("logo: preparar da una ruta del gimnasio; confirmar la usa y devuelve la anterior para borrarla", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const r1 = await preparar("logo", "image/png", 50_000);
    assert.match(r1, new RegExp(`^${t.g}/marca/logo-[0-9a-f]{32}\\.png$`));
    assert.equal(await confirmar("logo", r1), null);
    assert.equal((await datos()).logo_path, r1);
    const r2 = await preparar("logo", "image/svg+xml", 3_000);
    assert.equal(await confirmar("logo", r2), r1);
    assert.equal(await quitar("logo"), r2);
    assert.equal((await datos()).logo_path, null);
    const f = await preparar("favicon", "image/png", 10_000);
    await confirmar("favicon", f);
    assert.equal((await datos()).favicon_path, f);
  });
});

test("tipos y tamaños: cada rechazo dice qué subir", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => preparar("logo", "application/pdf", 1000), /PNG, JPG, SVG o WEBP/);
    await t.falla(() => preparar("favicon", "image/jpeg", 1000), /ícono tiene que ser PNG o SVG/);
    await t.falla(() => preparar("foto", "image/svg+xml", 1000), /JPG, PNG o WEBP/);
    await t.falla(() => preparar("logo", "image/png", 3 * 1024 * 1024), /pesa 3072 KB y el máximo es 2048 KB/);
    await t.falla(() => preparar("favicon", "image/png", 600 * 1024), /máximo es 512 KB/);
    await t.falla(() => preparar("logo", "image/png", 0), /vacío/);
    await t.falla(() => preparar("fondo", "image/png", 10), /desconocido/);
  });
});

test("rutas: no se confirma una imagen de otro gimnasio, de otra carpeta ni inventada", async () => {
  await t.comoUsuario(u.dueno, async () => {
    await t.falla(() => confirmar("logo", `${otro}/marca/logo-${"a".repeat(32)}.png`), /no es de este gimnasio/);
    await t.falla(() => confirmar("logo", `${t.g}/galeria/foto-${"a".repeat(32)}.png`), /no es de este gimnasio/);
    await t.falla(() => confirmar("logo", `${t.g}/marca/../../x.png`), /no es de este gimnasio/);
    await t.falla(() => confirmar("foto", `${t.g}/marca/logo-${"a".repeat(32)}.png`), /no es de este gimnasio/);
  });
});

test("fotos: hasta 12, se quitan y se ordenan; el orden con fotos que no son da error", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const rutas = [];
    for (let i = 0; i < 12; i++) { const r = await preparar("foto", "image/jpeg", 100_000); await confirmar("foto", r); rutas.push(r); }
    assert.deepEqual((await datos()).fotos, rutas);
    await t.falla(() => preparar("foto", "image/jpeg", 100_000), /Ya tenés 12 fotos/);
    assert.equal(await quitar("foto", rutas[0]), rutas[0]);
    await t.falla(() => quitar("foto", rutas[0]), /ya no está/);
    const nuevo = rutas.slice(1).reverse();
    await t.q(`select public.ordenar_fotos($1, $2)`, [t.g, nuevo]);
    assert.deepEqual((await datos()).fotos, nuevo);
    await t.falla(() => t.q(`select public.ordenar_fotos($1, $2)`, [t.g, nuevo.slice(1)]), /recargá/);
    await t.falla(() => t.q(`select public.ordenar_fotos($1, $2)`, [t.g, [...nuevo.slice(1), nuevo[1]]]), /recargá/);
  });
});

test("permisos: el encargado ve las imágenes pero no las cambia; otro gimnasio recibe error", async () => {
  await t.comoUsuario(u.encargado, async () => {
    assert.ok("fotos" in (await datos()));
    await t.falla(() => preparar("logo", "image/png", 1000), /Sin permiso/);
    await t.falla(() => quitar("logo"), /Sin permiso/);
  });
  await t.comoUsuario(u.ajeno, () => t.falla(() => preparar("logo", "image/png", 1000), /Sin permiso/));
});
