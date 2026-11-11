// Pedidos de solo lectura que la pantalla hace al servidor (buscar un socio, traer los planes del alta).
// Next aborta un pedido de servidor que está en vuelo cuando, en ese mismo momento, la pantalla se refresca
// (la entrada de otra compu llega en vivo, se cierra la hoja de cobro): la promesa se rechaza y quedaba una
// búsqueda sin respuesta o un paso "Plan" sin tarjetas. Como estos pedidos no cambian nada, repetirlos es seguro.
// Nunca se usa con acciones que escriben: esas llevan clave de operación (VD-34) y las maneja cada pantalla.
export async function leerConReintento<T>(pedir: () => Promise<T>, intentos = 3, pausaMs = 350): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try { return await pedir(); } catch (e) {
      ultimo = e;
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, pausaMs * (i + 1)));
    }
  }
  throw ultimo;
}
