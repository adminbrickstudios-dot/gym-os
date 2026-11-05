import { describe, expect, it } from "vitest";
import { svgSeguro, tipoReal } from "./imagenes";

const bytes = (...n: number[]) => new Uint8Array(n);
const texto = (s: string) => new TextEncoder().encode(s);

describe("tipoReal", () => {
  it("reconoce PNG, JPG, WEBP y SVG por sus bytes", () => {
    expect(tipoReal(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(tipoReal(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(tipoReal(texto("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(tipoReal(texto('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("image/svg+xml");
    expect(tipoReal(texto("<svg viewBox='0 0 1 1'/>"))).toBe("image/svg+xml");
  });
  it("no se deja engañar por la extensión", () => {
    expect(tipoReal(texto("%PDF-1.7"))).toBeNull();
    expect(tipoReal(texto("<html><svg></svg></html>"))).toBeNull();
    expect(tipoReal(bytes())).toBeNull();
  });
});

describe("svgSeguro", () => {
  it("acepta un logo común", () => {
    expect(svgSeguro('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/></svg>')).toBe(true);
  });
  it("rechaza scripts, eventos, links y contenido embebido", () => {
    expect(svgSeguro("<svg><script>alert(1)</script></svg>")).toBe(false);
    expect(svgSeguro('<svg onload="alert(1)"></svg>')).toBe(false);
    expect(svgSeguro('<svg><a href="javascript:alert(1)">x</a></svg>')).toBe(false);
    expect(svgSeguro("<svg><foreignObject><div/></foreignObject></svg>")).toBe(false);
    expect(svgSeguro('<svg><image href="https://otro.sitio/x.png"/></svg>')).toBe(false);
    expect(svgSeguro('<!DOCTYPE svg [<!ENTITY x "y">]><svg/>')).toBe(false);
  });
});
