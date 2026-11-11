export type Comando = { texto: string; destino: string; clave: string };

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Cada palabra escrita tiene que estar en el texto o en las palabras clave (sin tildes ni mayúsculas). Sin texto, todo. */
export function filtrarComandos(comandos: Comando[], q: string): Comando[] {
  const palabras = sinTildes(q).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return comandos;
  return comandos.filter((c) => { const t = sinTildes(`${c.texto} ${c.clave}`); return palabras.every((p) => t.includes(p)); });
}
