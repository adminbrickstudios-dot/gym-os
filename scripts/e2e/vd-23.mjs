#!/usr/bin/env node
// VD-23 · Inicio del socio: primera vez → bienvenida (se saltea y no vuelve);
// la semana, la racha y la meta del mes; entrar por QR → "Entraste" con la cuenta
// del mes que da la base. (Vencido → Pagar arriba: orden fijo en la pantalla; sin usuario demo vencido.)
//   node scripts/e2e/vd-23.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const sinDesborde = async (p, donde) => {
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `${donde}: sin desborde (${ancho}px)`, `${donde} desborda: ${ancho}px`);
};
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.getByText(/Podés entrar|No podés entrar/).first().waitFor({ timeout: 60000 });

  // Primera vez: bienvenida (si este socio ya la vio en una corrida anterior, no está y eso también es correcto).
  const bien = s.locator("[data-bienvenida]");
  if (await bien.count()) {
    ok(`primera vez: bienvenida “${(await bien.locator("h2").innerText()).trim()}”`);
    await capturar(s, "vd23-celu-bienvenida");
    await sinDesborde(s, "bienvenida");
    await bien.locator("[data-bienvenida-saltear], [data-bienvenida-listo]").first().click();
    await s.locator("[data-bienvenida]").waitFor({ state: "detached", timeout: 30000 });
    await s.reload();
    await s.getByText(/Podés entrar|No podés entrar/).first().waitFor({ timeout: 60000 });
    chequear(await s.locator("[data-bienvenida]").count() === 0, "saltearla la apaga: al volver no aparece", "la bienvenida volvió");
  } else ok("la bienvenida ya estaba vista: no vuelve");

  // La semana, la racha y la meta del mes (de la base).
  const prog = s.locator("[data-progreso]");
  chequear(await prog.count() >= 1, "el inicio muestra el progreso", "no hay progreso");
  if ((await prog.first().getAttribute("data-progreso")) !== "vacio") {
    chequear(await s.locator("[data-progreso] ol li").count() === 7, "la semana tiene 7 días", "la semana no tiene 7 días");
    const meta = await s.locator("[data-meta-mes]").getAttribute("data-meta-mes");
    chequear(/^\d+\/\d+$/.test(meta ?? ""), `meta del mes ${meta}`, `meta rara: ${meta}`);
    chequear(/seguidas/.test(await s.locator("[data-racha]").innerText()), "la racha dice las semanas seguidas", "falta la racha");
  } else ok("sin entradas todavía: el progreso invita a la primera");
  await sinDesborde(s, "inicio");
  await capturar(s, "vd23-celu-inicio");

  // "Entraste": la recepción lo deja pasar y el inicio muestra la hora y la cuenta del mes (las da la base).
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 30000 });
  await buscar.fill("Testigo Al Día");
  await r.locator("button.fila", { hasText: "Testigo Al Día" }).first().waitFor({ timeout: 15000 });
  await buscar.press("Enter");
  await r.locator('[data-veredicto="verde"]').waitFor({ timeout: 30000 });
  await r.keyboard.press("Enter");
  await r.locator("[data-hecho]").waitFor({ timeout: 30000 });
  await s.goto(`${G}/app`);
  const entraste = s.locator("[data-entraste]");
  await entraste.waitFor({ timeout: 60000 });
  const t = (await entraste.innerText()).replace(/\s+/g, " ").trim();
  chequear(/Entraste \d{2}:\d{2}/.test(t) && /este mes/.test(t), `“${t}”`, `texto raro: ${t}`);
  chequear(await s.locator("[data-meta-mes]").count() === 1, "con la entrada, la meta del mes aparece", "falta la meta del mes");
  await capturar(s, "vd23-celu-entraste");
  await sinDesborde(s, "inicio con Entraste");
  await r.locator('[data-hecho] button:has-text("Deshacer")').click().catch(() => {});   // no dejar la prueba anotada

  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
