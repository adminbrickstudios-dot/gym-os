import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { achicarFoto, LADO_MAXIMO, medidasAchicadas } from "./imagenes-servidor";
import { tipoReal } from "./imagenes";

describe("medidasAchicadas", () => {
  it("deja el lado largo en 800 y mantiene la proporción", () => {
    expect(medidasAchicadas(4000, 3000)).toEqual({ ancho: 800, alto: 600 });
    expect(medidasAchicadas(3000, 4000)).toEqual({ ancho: 600, alto: 800 });
  });
  it("nunca agranda", () => {
    expect(medidasAchicadas(400, 300)).toEqual({ ancho: 400, alto: 300 });
  });
});

describe("achicarFoto", () => {
  it("una foto grande queda a 800 px, en webp y liviana (< 200 KB)", async () => {
    // Un degradado con algo de textura: pesa varios cientos de KB en JPG a 3000x2000.
    const ancho = 3000, alto = 2000;
    const crudo = Buffer.alloc(ancho * alto * 3);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const i = (y * ancho + x) * 3;
        const ruido = ((x * 7 + y * 13) % 17) * 2;
        crudo[i] = (x / ancho) * 200 + ruido; crudo[i + 1] = (y / alto) * 200 + ruido; crudo[i + 2] = 90 + ruido;
      }
    }
    const grande = new Uint8Array(await sharp(crudo, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 92 }).toBuffer());
    const r = await achicarFoto(grande, "image/jpeg");
    expect(r.achicada).toBe(true);
    expect(r.mime).toBe("image/webp");
    expect(tipoReal(r.bytes)).toBe("image/webp");
    const meta = await sharp(r.bytes).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(LADO_MAXIMO);
    expect(r.bytes.length).toBeLessThan(200 * 1024);
    expect(r.bytes.length).toBeLessThan(grande.length);
  });
  it("si no es una imagen legible, devuelve la original sin romper", async () => {
    const basura = new Uint8Array([1, 2, 3, 4, 5]);
    const r = await achicarFoto(basura, "image/png");
    expect(r.achicada).toBe(false);
    expect(r.bytes).toBe(basura);
    expect(r.mime).toBe("image/png");
  });
});
