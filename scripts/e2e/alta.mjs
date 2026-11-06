// Ayudas del alta de socios (VD-6 / VD-5b), compartidas por los e2e que dan de alta a alguien.
// El plan se elige con tarjetas; "Dar de alta y cobrar" abre la hoja Cobrar en el lugar.

/** Elige un plan en las tarjetas del alta: un número (0 = el primero) o un texto del nombre. Devuelve el nombre del plan. */
export async function elegirPlan(p, que = 0) {
  const tarjeta = typeof que === "number" ? p.locator("[data-plan-tarjeta]").nth(que) : p.locator("[data-plan-tarjeta]", { hasText: que }).first();
  await tarjeta.waitFor({ timeout: 30000 });
  const nombre = await tarjeta.getAttribute("data-plan-nombre");
  await tarjeta.click();
  return nombre;
}

/** Después de "Dar de alta y cobrar": espera la hoja Cobrar abierta sobre el alta y devuelve el id del socio recién creado. */
export async function hojaDeAlta(p) {
  await p.locator('[data-cobrar][data-estado="listo"]').waitFor({ timeout: 30000 });
  return await p.locator("[data-alta-creado]").getAttribute("data-alta-creado");
}

/** Sigue en Vender con el socio y su cuota (para los e2e que prueban el carrito, no la hoja). */
export async function irAVender(p, socioId) {
  const origen = new URL(p.url()).origin;
  await p.goto(`${origen}/panel/vender?socio=${socioId}&cuota=1`);
}
