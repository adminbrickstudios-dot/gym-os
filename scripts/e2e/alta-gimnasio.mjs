// Ayudas del super admin (VD-40) para los e2e que dan de alta un gimnasio o entran como soporte.
// El alta es en 3 pasos (tipo → datos y marca → dueño) y entrar a un gimnasio pide el motivo.

/** Completa el alta de gimnasio en sus 3 pasos y aprieta "Crear gimnasio". `tipo` undefined deja el que viene; "" es sin plantilla. */
export async function altaGimnasio(p, { nombre, dueno, email, celular, tipo, acento, fondo }) {
  if (tipo !== undefined) await p.locator("select[name=tipo]").selectOption(tipo);
  await p.getByRole("button", { name: /Siguiente/ }).click();
  await p.fill("input[name=nombre]", nombre);
  if (acento) await p.locator("input[name=color_acento]").fill(acento);
  if (fondo) await p.locator("input[name=color_fondo]").fill(fondo);
  await p.getByRole("button", { name: /Siguiente/ }).click();
  await p.fill("input[name=dueno]", dueno);
  if (email) await p.fill("input[name=email]", email);
  if (celular) await p.fill("input[name=celular]", celular);
  await p.click('button:has-text("Crear gimnasio")');
}

/** Entra como Soporte BRIK: abre el pedido de motivo dentro de `donde` (página o fila), lo escribe y entra. */
export async function entrarSoporte(donde, motivo = "e2e: revisar el gimnasio") {
  await donde.locator("[data-entrar-soporte]").first().click();
  await donde.locator("input[name=motivo]").fill(motivo);
  await donde.locator('button:has-text("Entrar como soporte")').click();
}
