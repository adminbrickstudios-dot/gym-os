// Mientras carga: título y el cuadro de búsqueda.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10 space-y-6" aria-busy>
      <div className="h-12 w-72 rounded-[var(--radio)] bg-[var(--tarjeta)]" />
      <div className="tarjeta h-40 esqueleto" />
    </main>
  );
}
