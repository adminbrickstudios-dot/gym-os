// Mientras carga: título y las tarjetas de seguridad.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10 space-y-6" aria-busy>
      <div className="h-12 w-56 rounded-2xl bg-[var(--tarjeta)]" />
      <div className="tarjeta h-40 esqueleto" />
      <div className="tarjeta h-48 esqueleto" />
    </main>
  );
}
