// Datos para Google (schema.org HealthClub): todo sale de lo que ya cargó el
// dueño (nombre, logo, sedes, WhatsApp, Instagram y horarios). Función pura.
import type { Agenda } from "@/lib/horarios";
import type { LandingPublicada } from "@/lib/landing";

const DIA_SCHEMA = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function datosEstructurados(l: LandingPublicada, agenda: Agenda | null, origen: string, logo: string | null): Record<string, unknown>[] {
  const sedes = l.sedes.length ? l.sedes : [{ nombre: l.marca.nombre, direccion: null, mapa_url: null, telefono: null }];
  return sedes.map((s, i) => {
    const franjas = agenda?.sedes.find((x) => x.sede === s.nombre)?.franjas ?? (agenda?.sedes.length === 1 ? agenda.sedes[0].franjas : []);
    const tel = s.telefono ?? l.contacto.whatsapp;
    return Object.fromEntries(Object.entries({
      "@context": "https://schema.org",
      "@type": "HealthClub",
      "@id": `${origen}/#sede-${i + 1}`,
      name: sedes.length > 1 ? `${l.marca.nombre} · ${s.nombre}` : l.marca.nombre,
      description: l.portada.bajada ?? l.portada.titulo,
      url: `${origen}/`,
      logo: logo ?? undefined,
      image: logo ?? undefined,
      telephone: tel ?? undefined,
      email: l.contacto.email ?? undefined,
      address: s.direccion ? { "@type": "PostalAddress", streetAddress: s.direccion, addressCountry: "AR" } : undefined,
      hasMap: s.mapa_url ?? undefined,
      sameAs: l.contacto.instagram ? [`https://instagram.com/${l.contacto.instagram}`] : undefined,
      openingHoursSpecification: franjas.length
        ? franjas.map((f) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DIA_SCHEMA[f.dia], opens: f.abre.slice(0, 5), closes: f.cierra.slice(0, 5) }))
        : undefined,
    }).filter(([, v]) => v !== undefined));
  });
}
