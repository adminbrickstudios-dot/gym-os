#!/usr/bin/env node
// COM-12 · Lugar puntual: la dueña abre una clase y numera la sala (8 bicis,
// la 7 fuera de servicio) → el socio con reserva confirmada ve en la app
// "Elegí tu lugar": la 1 está ocupada, la 7 rota, elige la 3 → la clase en
// el panel dice quién está en la bici 3. Deja todo como estaba.
//   npm run e2e:com-12           (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [{ id: socio, nombre }] = (await db.query(`select s.id, trim(s.nombre || ' ' || coalesce(s.apellido, '')) nombre from public.socios s join auth.users u on u.id = s.usuario_id
  where s.gimnasio_id = $1 and u.email = 'socio@ejemplo.invalid'`, [gim])).rows;
// Una clase que viene, en la sede que muestra la app, sin reserva del socio todavía.
const [clase] = (await db.query(`select c.id, c.sede_id, c.actividad_id, to_char((c.inicio at time zone g.zona_horaria)::date, 'YYYY-MM-DD') dia
  from public.clases c join public.gimnasios g on g.id = c.gimnasio_id
 where c.gimnasio_id = $1 and c.cancelada_en is null and c.inicio > now() + interval '3 hours' and c.inicio < now() + interval '5 days'
   and c.sede_id = (select se.id from public.sedes se where se.gimnasio_id = $1 and se.activa order by se.es_principal desc, se.nombre limit 1)
   and not exists (select 1 from public.reservas r where r.clase_id = c.id and r.socio_id = $2 and r.estado <> 'cancelada')
   and not exists (select 1 from public.lugares_sala l where l.sede_id = c.sede_id and l.actividad_id = c.actividad_id)
 order by c.inicio limit 1`, [gim, socio])).rows;
if (!clase) { console.log("❌ no hay una clase que venga en el demo"); process.exit(1); }
const [{ id: otro }] = (await db.query(`select s.id from public.socios s where s.gimnasio_id = $1 and s.id <> $2 and s.dado_de_baja_en is null
  and not exists (select 1 from public.reservas r where r.clase_id = $3 and r.socio_id = s.id and r.estado <> 'cancelada') limit 1`, [gim, socio, clase.id])).rows;
const creadas = [];
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/clases/${clase.id}`);
  const l = d.locator("[data-lugares-clase]");
  await l.waitFor({ timeout: 60000 });
  await l.locator('button:has-text("Numerar la sala")').click();
  const f = d.locator("[data-numerar-sala]");
  await f.locator('input[aria-label="Cuántos lugares"]').fill("8");
  await f.locator('input[aria-label="Cómo se llaman los lugares"]').fill("Bici");
  await f.locator('input[aria-label="Lugares fuera de servicio"]').fill("7");
  await f.locator('button[type="submit"]').click();
  await l.locator('[data-lugar="8"]').waitFor({ timeout: 30000 });
  chequear(/Fuera de servicio/.test(await l.locator('[data-lugar="7"]').innerText()), "la dueña numera la sala: 8 bicis, la 7 fuera de servicio", await l.innerText());

  // El socio tiene la reserva confirmada; otro ya eligió la bici 1.
  for (const s of [socio, otro]) creadas.push((await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada') returning id`, [gim, clase.id, s])).rows[0].id);
  await db.query(`update public.reservas set lugar = 1 where id = $1`, [creadas[1]]);
  const so = await pagina(b, CELU);
  so.setDefaultNavigationTimeout(120000);
  await entrar(so, "socio@ejemplo.invalid");
  await so.goto(`${G}/app/clases?dia=${clase.dia}`);
  const e = so.locator("[data-elegir-lugar]").first();
  chequear(await aparece(e, 60000), "con la reserva confirmada, la app dice “📍 Elegí tu lugar (bici)”", "la app no ofrece elegir el lugar");
  chequear(await e.locator('[data-lugar="1"]').isDisabled() && await e.locator('[data-lugar="7"]').isDisabled(), "la 1 está ocupada y la 7 fuera de servicio (no se pueden tocar)", "se puede tocar una ocupada o rota");
  await e.locator('[data-lugar="3"]').click();
  chequear(await aparece(e.getByText("📍 Bici 3"), 30000), "elige la bici 3: “📍 Bici 3 · Cambiar”", await e.innerText());
  await capturar(so, "com12-celu-lugar");

  await d.reload();
  const tres = d.locator('[data-lugares-clase] [data-lugar="3"]');
  await tres.waitFor({ timeout: 60000 });
  chequear((await tres.innerText()).includes(nombre.split(" ")[0]), `la clase en el panel: bici 3 → ${nombre}`, await tres.innerText());
  for (const p of [d, so]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  for (const id of creadas) await db.query(`update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'equipo' where id = $1`, [id]).catch(() => {});
  await db.query(`delete from public.lugares_sala where gimnasio_id = $1 and sede_id = $2 and actividad_id = $3`, [gim, clase.sede_id, clase.actividad_id]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
