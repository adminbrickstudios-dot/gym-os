// Con la forma real del alta: título, planes y campos.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <main className="mx-auto max-w-3xl px-4 pt-20 space-y-8" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-14 w-2/3`} />
      <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-32`} />)}</div>
      <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bloque} h-16`} />)}</div>
    </main>
  );
}
