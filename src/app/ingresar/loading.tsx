// Con la forma real: logo y nombre arriba, y la tarjeta con el título y el formulario.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <main className="min-h-dvh flex items-center px-4 py-10" aria-busy="true" aria-label="Cargando">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className={`${bloque} size-12`} />
          <div className={`${bloque} h-8 w-40`} />
        </div>
        <div className="tarjeta space-y-4 !p-6">
          <div className={`${bloque} h-10 w-3/4`} />
          <div className={`${bloque} h-14`} />
          <div className={`${bloque} h-14`} />
          <div className={`${bloque} h-14`} />
        </div>
      </div>
    </main>
  );
}
