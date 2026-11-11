// Mientras carga: título, filtros y filas de la lista.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-8 py-10 space-y-6" aria-busy>
      <div className="h-12 w-64 rounded-2xl bg-[var(--tarjeta)]" />
      <div className="tarjeta h-32 esqueleto" />
      {[0, 1, 2, 3].map((i) => <div key={i} className="tarjeta h-28 esqueleto" />)}
    </main>
  );
}
