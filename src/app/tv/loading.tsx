// Con la forma real de la TV: encabezado, la clase de ahora con los nombres y la próxima abajo.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <main className="min-h-dvh p-8 lg:p-12 flex flex-col gap-8" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-12 w-1/2`} />
      <div className={`${bloque} h-28 w-2/3`} />
      <div className="grid grid-cols-3 gap-4">{Array.from({ length: 9 }).map((_, i) => <div key={i} className={`${bloque} h-14`} />)}</div>
      <div className={`${bloque} h-20 mt-auto`} />
    </main>
  );
}
