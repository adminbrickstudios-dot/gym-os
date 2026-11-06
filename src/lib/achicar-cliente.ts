// VD-38: la foto del celular se achica en el celular (1600 px, JPEG) antes de mandarla: una foto de 5 MB no
// tiene que viajar entera por datos móviles. Si el navegador no puede (formato raro), se manda la original.
export async function achicarEnNavegador(archivo: File, lado = 1600, calidad = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const f = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    if (f === 1 && archivo.size < 800 * 1024) { bmp.close(); return archivo; }
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(bmp.width * f)); lienzo.height = Math.max(1, Math.round(bmp.height * f));
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
    return blob && blob.size < archivo.size ? blob : archivo;
  } catch { return archivo; }
}
