// Con la forma real del Control: encabezado, tarjeta de filtros y filas de la línea de tiempo.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-56`} />
      <div className={`${bloque} h-6 w-24`} />
      <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bloque} h-[60px]`} />)}</div>
    </div>
  );
}
