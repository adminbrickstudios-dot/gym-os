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
  expect(d["@type"]).toBe("HealthClub");
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
