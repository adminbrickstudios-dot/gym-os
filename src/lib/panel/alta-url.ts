/**
 * "Darlo de alta" desde un buscador que no encontró a nadie: lo que se escribió llega puesto en el formulario.
 * Un DNI (6 a 9 cifras, con o sin puntos) va como `?dni=`; un nombre, como `?nombre=`; cualquier otra cosa, sin nada.
 */
export function urlDarDeAlta(escrito: string | null | undefined): string {
  const t = (escrito ?? "").trim();
  const dni = t.replace(/\./g, "");
  if (/^\d{6,9}$/.test(dni)) return `/panel/socios/nuevo?dni=${dni}`;
  if (/^[\p{L} '.-]{2,60}$/u.test(t)) return `/panel/socios/nuevo?nombre=${encodeURIComponent(t)}`;
  return "/panel/socios/nuevo";
}
