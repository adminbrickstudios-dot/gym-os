// Mientras carga: la forma real del super admin (título, alta, lista), sin datos inventados.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-8 py-10 space-y-10" aria-busy>
      <div className="space-y-3"><div className="size-10 rounded-[var(--radio)] bg-[var(--tarjeta)]" /><div className="h-14 w-72 rounded-[var(--radio)] bg-[var(--tarjeta)]" /></div>
      <div className="tarjeta h-40 esqueleto" />
      {[0, 1, 2].map((i) => <div key={i} className="tarjeta h-32 esqueleto" />)}
    </main>
  );
}
