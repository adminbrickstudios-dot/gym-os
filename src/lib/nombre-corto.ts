/** El nombre que va debajo del ícono: hasta 12 letras, sin cortar una palabra a la mitad. */
export function nombreCorto(nombre: string): string {
  if (nombre.length <= 12) return nombre;
  const palabras = nombre.split(/\s+/);
  let corto = "";
  for (const p of palabras) { const prueba = corto ? `${corto} ${p}` : p; if (prueba.length > 12) break; corto = prueba; }
  return corto || nombre.slice(0, 12);
}
