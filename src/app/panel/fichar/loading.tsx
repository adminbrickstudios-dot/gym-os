// Con la forma real: título, el botón de fichar, el PIN y la lista de horas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6 max-w-xl" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-20`} />
      <div className={`${bloque} h-44`} />
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-10`} />)}</div>
    </div>
  );
}
