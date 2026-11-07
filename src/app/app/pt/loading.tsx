// Con la forma real de Mi personal trainer: el volver, el título, el pack y los turnos.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-6 w-24`} />
      <div className={`${bloque} h-14 w-3/4`} />
      <div className={`${bloque} h-24`} />
      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
    </div>
  );
}
