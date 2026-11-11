// Con la forma real de la política: título, línea del gimnasio y los párrafos.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <main className="mx-auto max-w-3xl px-4 pt-20 space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-12 w-2/3`} />
      <div className={`${bloque} h-5 w-1/3`} />
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}
    </main>
  );
}
