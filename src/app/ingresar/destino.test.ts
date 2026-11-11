import { describe, expect, it } from "vitest";
import { armarLinkAyuda, demasiadosIntentos, motivoDeEntrada, sinConexion, TEXTO_SIN_GIMNASIO } from "./destino";

describe("VD-61 · casos de error del ingreso", () => {
  it("reconoce el límite de intentos de Supabase Auth", () => {
    expect(demasiadosIntentos({ status: 429, message: "x" })).toBe(true);
    expect(demasiadosIntentos({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" })).toBe(true);
    expect(demasiadosIntentos({ message: "For security purposes, you can only request this after 45 seconds." })).toBe(true);
  });
  it("no confunde un código malo ni la falta de conexión con el límite", () => {
    expect(demasiadosIntentos({ status: 403, code: "otp_expired", message: "Token has expired or is invalid" })).toBe(false);
    expect(demasiadosIntentos(null)).toBe(false);
    expect(demasiadosIntentos({ status: 0, message: "fetch failed" })).toBe(false);
    expect(sinConexion({ status: 0, message: "fetch failed" })).toBe(true);
  });
});

describe("PLAT-08: el motivo real de un ingreso fallido", () => {
  it("sin confirmar, desactivada y credenciales se distinguen", () => {
    expect(motivoDeEntrada({ code: "email_not_confirmed", message: "Email not confirmed" })).toBe("sin_confirmar");
    expect(motivoDeEntrada({ code: "user_banned", message: "User is banned" })).toBe("desactivada");
    expect(motivoDeEntrada({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("credenciales");
    expect(motivoDeEntrada(null)).toBe("credenciales");
  });
  it("sin gimnasio: texto honesto con salida", () => {
    expect(TEXTO_SIN_GIMNASIO).toMatch(/no tiene un gimnasio asignado/);
  });
  it("el link de ayuda a BRIK saca todo lo que no es número, y no borra la letra D", () => {
    expect(armarLinkAyuda("+54 9 387 555-1234", "a@ejemplo.invalid")).toMatch(/^https:\/\/wa\.me\/5493875551234\?text=/);
    // Con el bug viejo (/D/g) esta cadena quedaba con las letras y sin la D.
    expect(armarLinkAyuda("+54 9 387 D555-1234", "a@ejemplo.invalid")).toMatch(/^https:\/\/wa\.me\/5493875551234\?text=/);
    expect(armarLinkAyuda("123", "a@ejemplo.invalid")).toBeUndefined();
    expect(armarLinkAyuda(null, "a@ejemplo.invalid")).toBeUndefined();
  });
});
