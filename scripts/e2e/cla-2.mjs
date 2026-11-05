#!/usr/bin/env node
// CLA-2 · Turnos fijos: la dueña los prende; el socio elige un horario en la
// app ("📌 Dejarlo fijo") y le queda; lo quita. La recepción los ve en la
// ficha. Al final se apagan (el demo queda como estaba).
//   npm run e2e:cla-2            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ gimnasio_id: gim, socio_id: socio }] = (await db.query(`select s.gimnasio_id, s.id as socio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
  where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día'`)).rows;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=clases`);
  const cfg = d.locator("[data-turnos-config]");
  await cfg.waitFor({ timeout: 60000 });
  if (await cfg.getAttribute("data-turnos-config") === "no") {
    await cfg.locator('input[type="checkbox"]').check();
    await d.locator('[data-turnos-config="si"]').waitFor({ timeout: 30000 });
  }
  // El tilde cambia al toque (optimista): se espera a que la base lo tenga guardado.
  let prendidos = false;
  for (let i = 0; i < 40 && !prendidos; i++) {
    [{ turnos_fijos: prendidos }] = (await db.query(`select turnos_fijos from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
    if (!prendidos) await new Promise((r) => setTimeout(r, 500));
  }
  chequear(prendidos === true, "Configuración → Clases → 📌 Turnos fijos: prendidos (se guarda al tocar)", String(prendidos));

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/clases`);
  const zona = s.locator("[data-turnos-fijos]");
  await zona.waitFor({ timeout: 60000 });
  const opcion = zona.locator("select option").nth(1);
  const texto = (await opcion.innerText()).trim();
  await zona.locator("select").selectOption({ index: 1 });
  await zona.getByRole("button", { name: /Dejarlo fijo/ }).click();
  const actividad = texto.split(" · ")[0].replace(/^\S+\s/, "").trim();
  const fila = zona.locator("li", { hasText: actividad });
  await fila.first().waitFor({ timeout: 30000 });
  ok(`el socio elige “${texto}” → queda en Mis turnos fijos`);
  await capturar(s, "cla2-celu-turno");

  await d.goto(`${G}/panel/socios/${socio}`);
  await d.locator("[data-turnos-fijos]").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-turnos-fijos] li", { hasText: actividad }).count() >= 1, "la ficha (Resumen) muestra el turno fijo", "no está en la ficha");

  await fila.first().getByRole("button", { name: "Quitar" }).click();
  await zona.locator("li", { hasText: actividad }).first().waitFor({ state: "detached", timeout: 30000 });
  ok("“Quitar”: ya no está (y se cancelan las próximas que había reservado solo)");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.turnos_fijos set hasta = now() where gimnasio_id = $1 and hasta is null`, [gim]);
  await db.query(`update public.configuracion_gimnasio set turnos_fijos = false where gimnasio_id = $1`, [gim]);
  await db.end();
}
await b.close();
resultado();
