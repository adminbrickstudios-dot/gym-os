import { describe, expect, it } from "vitest";
import { chequearEntorno, datosDeClave, refDeUrlSupabase } from "./entorno";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (carga: Record<string, unknown>) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(carga)}.firma-falsa`;
const BUENO = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: "abcdefghijklmnop", role: "anon" }),
  SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: "abcdefghijklmnop", role: "service_role" }),
  NEXT_PUBLIC_DOMINIO_BASE: "base.ar", NEXT_PUBLIC_DOMINIO_PLATAFORMA: "app.base.ar", SUPABASE_REF_ESPERADO: "abcdefghijklmnop", VERCEL_ENV: "production",
};
const malos = (l: ReturnType<typeof chequearEntorno>) => l.filter((c) => c.nivel === "falta");

describe("variables por entorno", () => {
  it("todo bien: sin rojos y sin mostrar ninguna clave", () => {
    const l = chequearEntorno({ ...BUENO, VERCEL_TOKEN: "x" });
    expect(malos(l)).toEqual([]);
    const todo = JSON.stringify(l);
    expect(todo).not.toContain("firma-falsa");
    expect(todo).not.toContain(BUENO.SUPABASE_SERVICE_ROLE_KEY);
    expect(l.some((c) => /apunta al Supabase esperado \(abcdefghijklmnop\)/.test(c.titulo))).toBe(true);
  });
  it("dice qué variables faltan, por nombre", () => {
    const l = chequearEntorno({ NEXT_PUBLIC_SUPABASE_URL: BUENO.NEXT_PUBLIC_SUPABASE_URL });
    expect(malos(l)[0].titulo).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(malos(l)[0].titulo).toMatch(/NEXT_PUBLIC_DOMINIO_BASE/);
  });
  it("vista previa apuntando a otro Supabase: rojo con el ref que tiene y el esperado", () => {
    const l = chequearEntorno({ ...BUENO, NEXT_PUBLIC_SUPABASE_URL: "https://zzzzzzzzzzzzzzzz.supabase.co", VERCEL_ENV: "preview" });
    expect(malos(l).some((c) => /preview apunta a OTRO Supabase: zzzzzzzzzzzzzzzz, y se esperaba abcdefghijklmnop/.test(c.titulo))).toBe(true);
  });
  it("clave de servicio de otro proyecto", () => {
    const l = chequearEntorno({ ...BUENO, SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: "otroproyectoxxxxx", role: "service_role" }) });
    expect(malos(l).some((c) => /SUPABASE_SERVICE_ROLE_KEY es del proyecto otroproyectoxxxxx/.test(c.titulo))).toBe(true);
  });
  it("clave anon puesta como service_role: rojo, dice que con esa no se crean cuentas", () => {
    const l = chequearEntorno({ ...BUENO, SUPABASE_SERVICE_ROLE_KEY: BUENO.NEXT_PUBLIC_SUPABASE_ANON_KEY });
    const m = malos(l).find((c) => /es una clave "anon"/.test(c.titulo));
    expect(m?.detalle).toMatch(/no se pueden crear cuentas/);
  });
  it("sin SUPABASE_REF_ESPERADO avisa (amarillo) cómo cargarlo; sin VERCEL_TOKEN también, sin ser un error", () => {
    const { SUPABASE_REF_ESPERADO: _, ...sin } = BUENO; void _;
    const l = chequearEntorno(sin);
    expect(malos(l)).toEqual([]);
    expect(l.some((c) => c.nivel === "aviso" && /SUPABASE_REF_ESPERADO=abcdefghijklmnop/.test(c.detalle ?? ""))).toBe(true);
    expect(l.some((c) => c.nivel === "aviso" && /VERCEL_TOKEN/.test(c.titulo))).toBe(true);
  });
  it("las claves nuevas (sb_secret_…) no traen el proyecto: se avisa, no se rompe", () => {
    const l = chequearEntorno({ ...BUENO, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc123" });
    expect(malos(l)).toEqual([]);
    expect(l.some((c) => /clave nueva/.test(c.titulo))).toBe(true);
  });
  it("ESC-01: avisa si las funciones no corren en São Paulo o si una conexión directa no usa el pooler", () => {
    const l = chequearEntorno({ ...BUENO, VERCEL_REGION: "iad1", SUPABASE_DB_URL: "postgres://u:p@db.abcdefghijklmnop.supabase.co:5432/postgres" });
    expect(malos(l)).toEqual([]);
    expect(l.some((c) => c.nivel === "aviso" && /iad1/.test(c.titulo))).toBe(true);
    expect(l.some((c) => c.nivel === "aviso" && /no pasa por el pooler/.test(c.titulo))).toBe(true);
    expect(JSON.stringify(l)).not.toContain("u:p@");
    const bien = chequearEntorno({ ...BUENO, VERCEL_REGION: "gru1", SUPABASE_DB_URL: "postgres://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" });
    expect(bien.some((c) => /usa el pooler/.test(c.titulo))).toBe(true);
    expect(bien.some((c) => /gru1/.test(c.titulo))).toBe(false);
  });
  it("lee el ref de la URL y de las claves de la compu", () => {
    expect(refDeUrlSupabase("https://abcdefghijklmnop.supabase.co/rest/v1")).toBe("abcdefghijklmnop");
    expect(refDeUrlSupabase("http://127.0.0.1:54321")).toBe("local");
    expect(refDeUrlSupabase("https://ejemplo.com")).toBeNull();
    expect(datosDeClave(jwt({ iss: "supabase-local", role: "service_role" }))).toMatchObject({ ref: "local", rol: "service_role" });
    expect(datosDeClave("basura").formato).toBe("desconocido");
  });
});
