import { expect, test } from "vitest";
import { datosEstructurados } from "./datos-estructurados";
import type { LandingPublicada } from "./landing";

const l = {
  publicada: true, marca: { nombre: "Gimnasio Demo", slug: "demo", logo_path: null, favicon_path: null, color_acento: "#2fbf5b", color_fondo: "#14161b" },
  portada: { titulo: "Entrená", bajada: "Cerca de casa", foto_path: null, boton_texto: "Quiero" },
  contacto: { whatsapp: "+5490000111222", mensaje_whatsapp: "Hola", instagram: "gym.demo", email: null },
  mostrar_precios: true, secciones: [], planes: [],
  sedes: [{ nombre: "Sede principal", direccion: "Calle Ficticia 123", mapa_url: "https://maps.example/x", telefono: null }],
} as unknown as LandingPublicada;

test("un gimnasio con una sede: dirección, teléfono, Instagram y horarios por día", () => {
  const [d] = datosEstructurados(l, { sedes: [{ sede_id: "s", sede: "Sede principal", abierto: true, texto: null,
    franjas: [{ dia: 1, abre: "07:00:00", cierra: "22:00:00" }, { dia: 6, abre: "09:00", cierra: "13:00" }] }], cierres: [] }, "https://demo.gymos.app", null);
  expect(d["@type"]).toEqual(["ExerciseGym", "HealthClub"]);
  expect(d.name).toBe("Gimnasio Demo");
  expect(d.telephone).toBe("+5490000111222");
  expect(d.address).toEqual({ "@type": "PostalAddress", streetAddress: "Calle Ficticia 123", addressCountry: "AR" });
  expect(d.sameAs).toEqual(["https://instagram.com/gym.demo"]);
  expect(d.openingHoursSpecification).toEqual([
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "07:00", closes: "22:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "13:00" },
  ]);
  expect("email" in d).toBe(false);
});

test("varias sedes: una entrada por sede con su nombre", () => {
  const dos = { ...l, sedes: [...l.sedes, { nombre: "Centro", direccion: "Otra 1", mapa_url: null, telefono: "+5490000333444" }] } as LandingPublicada;
  const ds = datosEstructurados(dos, null, "https://x", null);
  expect(ds.map((x) => x.name)).toEqual(["Gimnasio Demo · Sede principal", "Gimnasio Demo · Centro"]);
  expect(ds[1].telephone).toBe("+5490000333444");
});

// F1.8 · Lo que el validador de Google pide de un negocio local: @context y @type, name, address con PostalAddress,
// url e image absolutas, horarios con día válido y apertura antes del cierre, y JSON que se serializa.
test("validador: campos obligatorios y formatos de cada entrada", () => {
  const dias = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const franjas = [1, 2, 3, 4, 5, 6, 7].map((dia) => ({ dia, abre: "07:00:00", cierra: "22:30:00" }));
  const dos = { ...l, contacto: { ...l.contacto, instagram: "@gym.demo" }, sedes: [...l.sedes, { nombre: "Centro", direccion: "Otra 1", mapa_url: null, telefono: null }] } as unknown as LandingPublicada;
  const agenda = { sedes: [{ sede_id: "s", sede: "Sede principal", abierto: true, texto: null, franjas }, { sede_id: "c", sede: "Centro", abierto: true, texto: null, franjas }], cierres: [] };
  const ds = datosEstructurados(dos, agenda, "https://demo.gymos.app", null);
  const ids = new Set<string>();
  for (const d of ds) {
    expect(d["@context"]).toBe("https://schema.org");
    expect(d["@type"]).toEqual(["ExerciseGym", "HealthClub"]);
    expect(typeof d.name).toBe("string");
    expect(new URL(String(d.url)).protocol).toBe("https:");
    expect(new URL(String(d.image)).protocol).toBe("https:");
    expect(new URL(String(d["@id"])).hash).toMatch(/^#sede-\d+$/);
    expect(ids.has(String(d["@id"]))).toBe(false);
    ids.add(String(d["@id"]));
    expect((d.address as Record<string, string>)["@type"]).toBe("PostalAddress");
    expect((d.address as Record<string, string>).streetAddress.length).toBeGreaterThan(0);
    expect(d.sameAs).toEqual(["https://instagram.com/gym.demo"]);
    const horarios = d.openingHoursSpecification as { "@type": string; dayOfWeek: string; opens: string; closes: string }[];
    expect(horarios).toHaveLength(7);
    for (const h of horarios) {
      expect(h["@type"]).toBe("OpeningHoursSpecification");
      expect(dias).toContain(h.dayOfWeek);
      expect(h.opens).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(h.closes).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(h.opens < h.closes).toBe(true);
    }
    expect(() => JSON.parse(JSON.stringify(d))).not.toThrow();
  }
});

test("sin logo, la imagen es la de la página y nunca queda vacía", () => {
  const [d] = datosEstructurados(l, null, "https://demo.gymos.app", null);
  expect(d.image).toBe("https://demo.gymos.app/og");
  const [c] = datosEstructurados(l, null, "https://demo.gymos.app", "https://cdn.ejemplo.invalid/logo.png");
  expect(c.image).toBe("https://cdn.ejemplo.invalid/logo.png");
});
