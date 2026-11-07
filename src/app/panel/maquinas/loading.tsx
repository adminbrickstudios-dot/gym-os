// Con la forma real de Máquinas: encabezado, el alta y las tarjetas de la lista.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-14 w-64`} />
      <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-28`} />)}</div>
    </div>
  );
}
