import { expect, test } from "vitest";
import { PASOS_ANOTATE, PASOS_DESCARGAR_APP, PIE_ANOTATE, cartelPuerta, linkCompartirWhatsapp, mensajeAnotate } from "./carteles";

const EMOJI = /\p{Extended_Pictographic}/u;

test("con la tablet y su QR prendidos, el cartel manda a escanear el de la tablet y avisa que no se imprime", () => {
  const c = cartelPuerta(["kiosco", "qr_pared", "qr_socio"], "Gimnasio Demo");
  expect(c.titulo).toMatch(/QR de la tablet/);
  expect(c.pasos[0]).toContain("Gimnasio Demo");
  expect(c.aviso).toMatch(/30 segundos/);
  expect(c.pie).toMatch(/tablet/);
});

test("sin tablet pero con QR del socio, el cartel dice que lo muestre en la entrada", () => {
  const c = cartelPuerta(["qr_socio"], "Box");
  expect(c.titulo).toMatch(/QR de tu app/);
  expect(c.pasos.at(-1)).toMatch(/entrada/);
  expect(c.pie).toMatch(/recepción/);
  expect(c.pie).not.toMatch(/tablet/);
});

test("el QR de la tablet sin la tablet no se promete (qr_pared suelto no cuenta)", () => {
  expect(cartelPuerta(["qr_pared"], "Box").titulo).not.toMatch(/tablet/);
});

test("sin ninguna entrada digital, el cartel dice solo del DNI y avisa a quien lo imprime", () => {
  const c = cartelPuerta(["recepcion"], "Box");
  expect(c.pasos).toEqual([]);
  expect(c.titulo).toMatch(/DNI/);
  expect(c.aviso).toMatch(/Configuración/);
});

test("los textos de los carteles no llevan emojis", () => {
  for (const formas of [[], ["qr_socio"], ["kiosco"], ["kiosco", "qr_pared"]]) {
    const c = cartelPuerta(formas, "Box");
    for (const t of [c.titulo, c.pie, c.aviso ?? "", ...c.pasos]) expect(EMOJI.test(t), t).toBe(false);
  }
  for (const t of PASOS_DESCARGAR_APP) expect(EMOJI.test(t), t).toBe(false);
});

test("C9: el cartel Anotate acá no promete acceso y no lleva emojis; el mensaje de WhatsApp lleva el link", () => {
  for (const t of [...PASOS_ANOTATE, PIE_ANOTATE]) expect(EMOJI.test(t), t).toBe(false);
  expect(PIE_ANOTATE).toMatch(/cuando pagás/);
  const m = mensajeAnotate("Gimnasio Demo", "https://demo.ejemplo.invalid/hacete-socio");
  expect(m).toContain("https://demo.ejemplo.invalid/hacete-socio");
  const wa = linkCompartirWhatsapp(m);
  expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
  expect(decodeURIComponent(wa.split("text=")[1])).toBe(m);
});
