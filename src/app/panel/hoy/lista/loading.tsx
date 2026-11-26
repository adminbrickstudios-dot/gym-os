// La forma real de Para hacer hoy (la lista única): título, la tarjeta de lo que está en juego, los filtros, las filas y "Hecho hoy".
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-20 w-2/3`} />
      <div className={`${bloque} h-24`} />
      <div className="flex flex-wrap gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-11 w-32`} />)}</div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
        <div className={`${bloque} h-64`} />
      </div>
    </div>
  );
}
