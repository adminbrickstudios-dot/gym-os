// Mientras carga: título y las tres tarjetas.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-8 py-10 space-y-6" aria-busy>
      <div className="h-12 w-64 rounded-[var(--radio)] bg-[var(--tarjeta)]" />
      {[0, 1, 2].map((i) => <div key={i} className="tarjeta h-32 esqueleto" />)}
    </main>
  );
}
