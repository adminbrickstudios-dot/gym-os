// Mientras carga: título y filas del registro.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-8 py-10 space-y-6" aria-busy>
      <div className="h-12 w-64 rounded-2xl bg-[var(--tarjeta)]" />
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="tarjeta h-14 esqueleto" />)}
    </main>
  );
}
