// VD-47X · Fotos livianas: lo que se sube se achica a 800 px y se guarda en webp.
// Una foto de celular de 4 MB pasa a unos 60 KB, y el panel y la landing la bajan al toque.
// Solo en el servidor (usa sharp, que viene con Next). Si sharp no está o la imagen no se puede
// leer, se sube la original: achicar es una mejora, nunca una razón para que falle una subida.

export const LADO_MAXIMO = 800;
const CALIDAD = 80;

/** Medidas de salida: el lado más largo queda en `maximo` como mucho; nunca se agranda. */
export function medidasAchicadas(ancho: number, alto: number, maximo = LADO_MAXIMO): { ancho: number; alto: number } {
  if (ancho <= 0 || alto <= 0) return { ancho, alto };
  const f = Math.min(1, maximo / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) };
}

export type FotoAchicada = { bytes: Uint8Array; mime: "image/webp" | "image/png" | "image/jpeg"; achicada: boolean };

/** Achica a LADO_MAXIMO px y pasa a webp (respeta la rotación del celular y la transparencia). */
export async function achicarFoto(bytes: Uint8Array, mime: FotoAchicada["mime"]): Promise<FotoAchicada> {
  const original: FotoAchicada = { bytes, mime, achicada: false };
  try {
    const sharp = (await import("sharp")).default;
    const salida = await sharp(bytes, { failOn: "none", limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .webp({ quality: CALIDAD })
      .toBuffer();
    // Si por algún motivo quedó más grande que la original (una imagen ya mínima), se deja la original.
    if (salida.length >= bytes.length) return original;
    return { bytes: new Uint8Array(salida.buffer, salida.byteOffset, salida.byteLength), mime: "image/webp", achicada: true };
  } catch {
    return original;
  }
}
