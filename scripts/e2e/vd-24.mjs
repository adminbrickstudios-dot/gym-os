#!/usr/bin/env node
// VD-24 · Lista de espera automática y motivo de "no podés reservar".
//  1) Clase llena: la app dice que está llena y ofrece "Anotarme en espera"; el socio se anota (1° en espera).
//  2) Se libera un lugar (alguien cancela): el socio de la espera queda confirmado solo, con su aviso arriba.
//  3) Un socio con la cuota vencida ve el motivo en una frase y el botón Pagar (no un Reservar que falla).
//  Celular 390 px sin desbordes.
//   node scripts/e2e/vd-24.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const socioDe = async (apellido) => (await db.query(`select s.id, s.gimnasio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
  where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = $1`, [apellido])).rows[0];
const alDia = await socioDe("Al Día"), porVencer = await socioDe("Por Vencer");
const gim = alDia.gimnasio_id;
const [{ modo_clases: modoAntes }] = (await db.query(`select modo_clases from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
const [{ zona_horaria: zona }] = (await db.query(`select zona_horaria from public.gimnasios where id = $1`, [gim])).rows;
await db.query(`update public.configuracion_gimnasio set modo_clases = 'reserva', falta_politica = 'nada' where gimnasio_id = $1`, [gim]);
const act = (await db.query(`select id from public.actividades where gimnasio_id = $1 and activa limit 1`, [gim])).rows[0].id;
const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
// Una clase con un solo lugar, pasado mañana a la tarde (siempre dentro de los 7 días que se pueden reservar).
const { id: clase, dia } = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo)
  values ($1,$2,$3, now() + interval '30 hours', now() + interval '31 hours', 1)
  returning id, to_char(inicio at time zone $4, 'YYYY-MM-DD') as dia`, [gim, sede, act, zona])).rows[0];
const { id: reservaOtro } = (await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada') returning id`, [gim, clase, porVencer.id])).rows[0];

const b = await navegador();
try {
  // 1) Clase llena → "Anotarme en espera".
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/clases?dia=${dia}`);
  const fila = s.locator(`[data-clase="${clase}"]`);
  await fila.waitFor({ timeout: 60000 });
  const motivo = fila.locator("[data-motivo]");
  await motivo.waitFor({ timeout: 30000 });
  chequear((await motivo.getAttribute("data-motivo")) === "cupo_lleno" && /La clase está llena/.test(await motivo.innerText()),
    `la app dice por qué: “${(await motivo.innerText()).slice(0, 70)}…”`, "no dice que la clase está llena");
  const anotarme = fila.getByRole("button", { name: "Anotarme en espera" });
  chequear(await anotarme.isVisible(), "el botón que corresponde es “Anotarme en espera”", "falta el botón de espera");
  chequear((await s.evaluate(() => document.documentElement.scrollWidth)) <= CELU.width, "celular 390 px: sin desborde", "la pantalla desborda en el celular");
  await capturar(s, "vd24-celu-llena");
  await anotarme.click();
  await fila.getByText(/1° en espera/).waitFor({ timeout: 30000 });
  ok("el socio se anota: queda 1° en espera");

  // 2) Alguien cancela → el socio sube solo y queda avisado.
  const [{ r: subio }] = (await db.query(`select privado.cancelar_reserva($1, 'equipo', true, now()) as r`, [reservaOtro])).rows;
  const [mia] = (await db.query(`select id, estado, promovida_en from public.reservas where clase_id = $1 and socio_id = $2 and estado <> 'cancelada'`, [clase, alDia.id])).rows;
  chequear(mia?.estado === "confirmada" && mia.promovida_en && subio === mia.id, "en la base: se liberó el lugar y subió el primero de la espera", `reserva rara: ${JSON.stringify(mia)}`);
  const [{ n }] = (await db.query(`select count(*)::int n from public.avisos_pendientes where clase_id = $1 and socio_id = $2 and tipo = 'lugar_liberado'`, [clase, alDia.id])).rows;
  chequear(n === 1, "queda un aviso para él (uno solo)", `avisos: ${n}`);
  await s.goto(`${G}/app/clases?dia=${dia}`);
  await s.locator("[data-avisos-lugar]").waitFor({ timeout: 60000 });
  chequear(/Se liberó un lugar: tenés confirmada/.test(await s.locator("[data-avisos-lugar]").innerText()), "la app le cuenta arriba: “Se liberó un lugar: tenés confirmada…”", "no aparece el aviso");
  await s.locator(`[data-clase="${clase}"]`).getByText("Reservada").waitFor({ timeout: 30000 });
  ok("la clase figura como Reservada, sin que él haga nada");
  await capturar(s, "vd24-celu-subio");

  // 3) La cuota vencida: el motivo y el botón Pagar.
  const v = await pagina(b, CELU);
  await entrar(v, "socio-vencido@ejemplo.invalid");
  await v.goto(`${G}/app/clases?dia=${dia}`);
  const filaV = v.locator(`[data-clase="${clase}"]`);
  await filaV.waitFor({ timeout: 60000 });
  const mv = filaV.locator("[data-motivo]");
  await mv.waitFor({ timeout: 30000 });
  chequear((await mv.getAttribute("data-motivo")) === "vencido" && /pagá para poder reservar/.test(await mv.innerText()),
    `cuota vencida: “${(await mv.innerText()).slice(0, 70)}”`, "no explica el motivo del vencido");
  const pagar = filaV.locator('[data-accion-motivo="pagar"]');
  chequear(await pagar.isVisible() && (await filaV.getByRole("button", { name: /Reservar|espera/ }).count()) === 0,
    "en lugar de un Reservar que falla, el botón es Pagar", "sigue el botón de reservar");
  chequear((await v.evaluate(() => document.documentElement.scrollWidth)) <= CELU.width, "celular 390 px: sin desborde (vencido)", "desborda en el celular");
  await capturar(v, "vd24-celu-vencido");
  await pagar.click();
  await v.waitForURL((u) => u.pathname === "/app", { timeout: 30000 });
  ok("Pagar lleva a la pantalla de pago");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`delete from public.envios_push where referencia in (select id from public.reservas where clase_id = $1)`, [clase]).catch(() => {});
  await db.query(`delete from public.avisos_pendientes where clase_id = $1`, [clase]);
  await db.query(`delete from public.reservas where clase_id = $1`, [clase]);
  await db.query(`delete from public.clases where id = $1`, [clase]);
  await db.query(`update public.configuracion_gimnasio set modo_clases = $2 where gimnasio_id = $1`, [gim, modoAntes]);
  await db.end();
  await b.close();
}
resultado();
