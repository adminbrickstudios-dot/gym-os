// Memoria corta del servidor (VD-47): guarda un valor unos segundos para no
// preguntarle a la base lo mismo en cada pedido. Solo para datos públicos que
// casi no cambian (qué gimnasio es una dirección). Nunca permisos ni plata.
type Entrada<T> = { valor: T; vence: number };

export function memoriaCorta<T>(ttlMs: number, maximo = 500) {
  const mapa = new Map<string, Entrada<T>>();
  return {
    /** Devuelve lo guardado, o llama a `buscar` una vez y lo guarda. Un error no se guarda. */
    async obtener(clave: string, buscar: () => Promise<T>, ahora = Date.now()): Promise<T> {
      const e = mapa.get(clave);
      if (e && e.vence > ahora) return e.valor;
      const valor = await buscar();
      // Un "no existe" no se recuerda: un gimnasio recién creado tiene que aparecer al instante.
      if (valor === undefined || valor === null) return valor;
      if (mapa.size >= maximo) mapa.delete(mapa.keys().next().value as string);
      mapa.set(clave, { valor, vence: ahora + ttlMs });
      return valor;
    },
    limpiar: () => mapa.clear(),
  };
}
