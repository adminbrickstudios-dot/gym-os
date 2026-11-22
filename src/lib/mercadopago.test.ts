import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { firmaValida, firmar } from "@/lib/mercadopago";

// Vuelta final (22/11) · seguridad: la firma del webhook de Mercado Pago. Un evento firmado con la clave del gimnasio pasa;
// cualquier otra cosa (otra clave, otro pago, otro request-id, firma rota o faltante) da false y la ruta contesta 401.
const SECRETO = "clave-del-webhook-de-prueba";
const REQ = "8f3c1a2b-0000-4000-8000-000000000001";

describe("firmaValida (webhook de Mercado Pago)", () => {
  it("acepta un evento firmado como lo firma Mercado Pago", () => {
    expect(firmaValida(SECRETO, firmar(SECRETO, "123456789", REQ), REQ, "123456789")).toBe(true);
  });
  it("el data.id alfanumérico se firma en minúsculas", () => {
    expect(firmaValida(SECRETO, firmar(SECRETO, "abc123", REQ), REQ, "ABC123")).toBe(true);
  });
  it("rechaza la firma hecha con otra clave (la de otro gimnasio)", () => {
    expect(firmaValida(SECRETO, firmar("otra-clave", "123456789", REQ), REQ, "123456789")).toBe(false);
  });
  it("rechaza la firma de un pago puesta en otro pago", () => {
    expect(firmaValida(SECRETO, firmar(SECRETO, "123456789", REQ), REQ, "999999999")).toBe(false);
  });
  it("rechaza si cambia el request-id", () => {
    expect(firmaValida(SECRETO, firmar(SECRETO, "123456789", REQ), "otro-request", "123456789")).toBe(false);
  });
  it("rechaza sin firma, sin clave, sin id o con la firma rota", () => {
    const f = firmar(SECRETO, "123456789", REQ);
    expect(firmaValida(SECRETO, null, REQ, "123456789")).toBe(false);
    expect(firmaValida("", f, REQ, "123456789")).toBe(false);
    expect(firmaValida(SECRETO, f, REQ, null)).toBe(false);
    expect(firmaValida(SECRETO, "ts=1,v1=zz", REQ, "123456789")).toBe(false);
    expect(firmaValida(SECRETO, "v1=" + f.split("v1=")[1], REQ, "123456789")).toBe(false);
    expect(firmaValida(SECRETO, f.slice(0, -1) + (f.endsWith("0") ? "1" : "0"), REQ, "123456789")).toBe(false);
  });
});
