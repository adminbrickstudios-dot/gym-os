// Con la forma real: el título y el formulario.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <main className="min-h-dvh flex items-center px-4 py-12" aria-busy="true" aria-label="Cargando">
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className={`${bloque} size-12`} />
        <div className={`${bloque} h-14 w-3/4`} />
        <div className={`${bloque} h-14`} />
        <div className={`${bloque} h-14`} />
      </div>
    </main>
  );
}
