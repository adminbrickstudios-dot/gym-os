import { describe, expect, it } from "vitest";
import { conTextosPorDefecto, tipoDeGimnasio } from "./landing-defaults";
import type { LandingPublicada } from "./landing";

const base = (sobre: Partial<LandingPublicada>): LandingPublicada => ({
  publicada: true,
  marca: { nombre: "Gimnasio Ejemplo", slug: "ejemplo", logo_path: null, favicon_path: null, color_acento: "#16a34a", color_fondo: "#faf7f0" },
  portada: { titulo: "Ejemplo", bajada: null, foto_path: null, boton_texto: "Quiero empezar" },
  contacto: { whatsapp: null, mensaje_whatsapp: "Hola", instagram: null, email: null },
  mostrar_precios: true,
  secciones: [], planes: [], sedes: [],
  ...sobre,
});

describe("textos por defecto de la página", () => {
  it("deduce el tipo por las actividades y los planes", () => {
    expect(tipoDeGimnasio(base({}))).toBe("general");
    expect(tipoDeGimnasio(base({ secciones: [{ tipo: "actividades", titulo: "A", contenido: { items: [{ nombre: "Muay Thai" }] } }] }))).toBe("lucha");
    expect(tipoDeGimnasio(base({ planes: [{ nombre: "CrossFit libre", tipo: "membresia", descripcion: null }] }))).toBe("funcional");
    expect(tipoDeGimnasio(base({ planes: [{ nombre: "Yoga x semana", tipo: "pack", descripcion: null }] }))).toBe("mente_cuerpo");
  });

  it("completa lo vacío y nunca pisa lo que cargó el dueño", () => {
    const l = conTextosPorDefecto(base({
      portada: { titulo: "T", bajada: "Mi frase", foto_path: null, boton_texto: "x" },
      secciones: [
        { tipo: "sobre_nosotros", titulo: "Quiénes somos", contenido: { texto: "  " } },
        { tipo: "preguntas", titulo: "Preguntas", contenido: { items: [] } },
        { tipo: "probar", titulo: "Probá", contenido: {} },
      ],
    }));
    expect(l.portada.bajada).toBe("Mi frase");
    const sobre = l.secciones.find((s) => s.tipo === "sobre_nosotros");
    expect(sobre && sobre.tipo === "sobre_nosotros" && sobre.contenido.texto).toContain("Gimnasio Ejemplo");
    const preg = l.secciones.find((s) => s.tipo === "preguntas");
    expect(preg && preg.tipo === "preguntas" && preg.contenido.items?.some((i) => /probar antes/i.test(i.pregunta))).toBe(true);
    const propio = conTextosPorDefecto(base({ secciones: [{ tipo: "sobre_nosotros", titulo: "Q", contenido: { texto: "Nuestro texto" } }] }));
    const s = propio.secciones[0];
    expect(s.tipo === "sobre_nosotros" && s.contenido.texto).toBe("Nuestro texto");
  });

  it("sin planes no promete cómo pagar, y sin probar no ofrece la prueba", () => {
    const l = conTextosPorDefecto(base({ secciones: [{ tipo: "preguntas", titulo: "P", contenido: {} }] }));
    const s = l.secciones[0];
    const txt = JSON.stringify(s.tipo === "preguntas" ? s.contenido.items : []);
    expect(txt).not.toMatch(/medios de pago/);
    expect(txt).not.toMatch(/probar antes/);
  });

  it("con altas online la respuesta de cómo anotarse manda al botón, y sin ellas a WhatsApp", () => {
    const sec = [{ tipo: "preguntas" as const, titulo: "P", contenido: {} }];
    const planes = [{ nombre: "Mensual", tipo: "membresia" as const, descripcion: null }];
    const texto = (altas: boolean) => {
      const s = conTextosPorDefecto(base({ secciones: sec, planes, altas_online: altas })).secciones[0];
      return JSON.stringify(s.tipo === "preguntas" ? s.contenido.items : []);
    };
    expect(texto(true)).toMatch(/Quiero ser socio/);
    expect(texto(true)).not.toMatch(/escribinos por WhatsApp/);
    expect(texto(false)).toMatch(/escribinos por WhatsApp/);
  });

  it("no deja ningún texto de relleno", () => {
    const l = conTextosPorDefecto(base({ secciones: [{ tipo: "sobre_nosotros", titulo: "Q", contenido: {} }] }));
    expect(JSON.stringify(l.secciones)).not.toMatch(/lorem|ipsum|undefined|null/i);
  });
});
