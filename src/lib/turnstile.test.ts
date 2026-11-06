import { describe, expect, it } from "vitest";
import { crearPase, paseValido, turnstileActivo, verificarToken, VIGENCIA_PASE_MS } from "./turnstile";

const respuesta = (cuerpo: unknown, ok = true) => (async () => ({ ok, json: async () => cuerpo })) as unknown as typeof fetch;

describe("VD-33c · Turnstile", () => {
  it("sin las dos variables no está activo (todo sigue igual)", () => {
    expect(turnstileActivo({} as NodeJS.ProcessEnv)).toBe(false);
    expect(turnstileActivo({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "a" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(turnstileActivo({ TURNSTILE_SECRET_KEY: "b" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(turnstileActivo({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "a", TURNSTILE_SECRET_KEY: "b" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("sin token no pasa, y ni siquiera pregunta a Cloudflare", async () => {
    let llamadas = 0;
    const f = (async () => { llamadas++; return { ok: true, json: async () => ({ success: true }) }; }) as unknown as typeof fetch;
    const r = await verificarToken("", null, "secreto", f);
    expect(r.ok).toBe(false);
    expect(llamadas).toBe(0);
  });

  it("pasa solo si Cloudflare dice success", async () => {
    expect((await verificarToken("t", "1.2.3.4", "s", respuesta({ success: true }))).ok).toBe(true);
    expect((await verificarToken("t", null, "s", respuesta({ success: false }))).ok).toBe(false);
    expect((await verificarToken("t", null, "s", respuesta({}, false))).ok).toBe(false);
  });

  it("si Cloudflare no responde, no pasa", async () => {
    const roto = (async () => { throw new Error("sin red"); }) as unknown as typeof fetch;
    expect((await verificarToken("t", null, "s", roto)).ok).toBe(false);
  });

  it("manda el secreto, el token y la IP a siteverify", async () => {
    let enviado: { url?: string; body?: string } = {};
    const f = (async (url: string, init: RequestInit) => { enviado = { url, body: String(init.body) }; return { ok: true, json: async () => ({ success: true }) }; }) as unknown as typeof fetch;
    await verificarToken("tok", "9.9.9.9", "sec", f);
    expect(enviado.url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(enviado.body).toContain("secret=sec");
    expect(enviado.body).toContain("response=tok");
    expect(enviado.body).toContain("remoteip=9.9.9.9");
  });

  it("el pase vale para ese destino, vence y no se falsifica", () => {
    const ahora = 1_700_000_000_000;
    const pase = crearPase("sec", "+5493875551234", ahora);
    expect(paseValido(pase, "sec", "+5493875551234", ahora + 1000)).toBe(true);
    expect(paseValido(pase, "sec", "+5493875550000", ahora + 1000)).toBe(false);
    expect(paseValido(pase, "otra", "+5493875551234", ahora + 1000)).toBe(false);
    expect(paseValido(pase, "sec", "+5493875551234", ahora + VIGENCIA_PASE_MS + 1)).toBe(false);
    expect(paseValido(undefined, "sec", "x")).toBe(false);
    expect(paseValido("123.abc", "sec", "x", 0)).toBe(false);
  });
});
