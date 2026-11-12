import { describe, expect, it } from "vitest";
import { linkAyudaWhatsapp, pantallaSinIds, textoAyuda } from "./ayuda-brik";

const base = { gimnasio: "Gimnasio X", nombre: "Ana", rol: "recepcion", pantalla: "/panel/socios/3f2a9c1e-1111-4222-8333-444455556666?q=Perez", ultimoError: null };

describe("ayuda a BRIK por WhatsApp (H6)", () => {
  it("tapa los ids y los parámetros de la dirección", () => {
    expect(pantallaSinIds(base.pantalla)).toBe("/panel/socios/:id");
  });
  it("arma el link con pantalla, quién y último error, al número de los datos", () => {
    const l = linkAyudaWhatsapp("+54 9 000 123-4567", { ...base, ultimoError: "no se pudo guardar" })!;
    expect(l.startsWith("https://wa.me/5490001234567?text=")).toBe(true);
    const t = decodeURIComponent(l.split("text=")[1]);
    expect(t).toContain("Pantalla: /panel/socios/:id");
    expect(t).toContain("Quién: Ana (recepción)");
    expect(t).toContain("Último error: no se pudo guardar");
    expect(t).not.toContain("Perez");
    expect(t).not.toContain("3f2a9c1e");
  });
  it("sin número cargado no hay link", () => {
    expect(linkAyudaWhatsapp(null, base)).toBeNull();
    expect(linkAyudaWhatsapp("abc", base)).toBeNull();
  });
  it("recorta un error larguísimo y dice 'ninguno' si no hubo", () => {
    expect(textoAyuda(base)).toContain("Último error: ninguno");
    expect(textoAyuda({ ...base, ultimoError: "x".repeat(900) }).length).toBeLessThan(400);
  });
});
