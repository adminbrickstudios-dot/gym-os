// Con la forma real de Mi locker: el volver, el título y la tarjeta del locker.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-6 w-24`} />
      <div className={`${bloque} h-14 w-2/3`} />
      <div className={`${bloque} h-28`} />
    </div>
  );
}
