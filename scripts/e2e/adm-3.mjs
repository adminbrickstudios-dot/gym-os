#!/usr/bin/env node
// ADM-3 / ADM-2 · Abono de Gym OS: el admin carga un plan de BRIK con su
// precio, crea un gimnasio, le asigna el plan ("✅ Al día", 14 días) y le
// registra un pago. Vencido (simulado en la base), el panel muestra "solo
// lectura". Que la base no deje vender lo prueba abono-brik.
//   npm run e2e:adm-3            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, PLATAFORMA as B, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-5);
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  const planes = p.locator("[data-planes-brik]");
  await planes.waitFor({ timeout: 60000 });
  await planes.getByPlaceholder("Básico").fill(`Plan e2e ${s}`);
  await planes.locator("input[inputmode=decimal]").fill("30000");
  await planes.getByRole("button", { name: /Sumar plan/ }).click();
  await planes.getByText(`Plan e2e ${s}`).waitFor({ timeout: 30000 });
  ok("💳 el admin carga un plan de Gym OS con su precio");

  await p.fill("input[name=nombre]", `Abono ${s}`);
  await p.fill("input[name=dueno]", "Dueño Abono");
  await p.locator("select[name=tipo]").selectOption("");
  await p.click('button:has-text("Crear gimnasio")');
  await p.getByText(/está creado/).first().waitFor({ timeout: 60000 });
  await p.getByRole("link", { name: /Equipo, claves y direcciones/ }).click();
  await p.waitForURL(/\/admin\/[0-9a-f-]{36}/, { timeout: 30000 });
  const gid = p.url().split("/").pop();
  const ab = p.locator("[data-abono-gimnasio]");
  await ab.locator("select").selectOption(await ab.locator("option", { hasText: `Plan e2e ${s}` }).getAttribute("value"));
  await ab.locator('[data-abono="al_dia"]').waitFor({ timeout: 30000 });
  ok("le asigna el plan: “✅ Al día” (14 días hasta el primer pago)");
  await ab.locator('input[type="date"]').fill(new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10));
  await ab.getByRole("button", { name: /Registrar pago/ }).click();
  await ab.getByText(/cubre hasta/).first().waitFor({ timeout: 30000 });
  ok("💵 registra un pago y queda en la lista");

  await db.query(`update public.plataforma_pagos set anulado_en = now() where gimnasio_id = $1`, [gid]);
  await db.query(`update public.gimnasios set plataforma_desde = current_date - 30 where id = $1`, [gid]);
  await p.reload();
  await ab.locator('[data-abono="vencido"]').waitFor({ timeout: 30000 });
  await p.getByRole("button", { name: /Entrar al panel/ }).first().click();
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  await p.locator("[data-solo-lectura]").waitFor({ timeout: 60000 });
  chequear(/solo lectura/.test(await p.locator("[data-solo-lectura]").innerText()), "vencido: el panel avisa “solo lectura” (la puerta y la app siguen)", "no avisa");
  if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.end();
}
await b.close();
resultado();
