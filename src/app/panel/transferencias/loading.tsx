// Con la forma real de Transferencias: título y los comprobantes para revisar.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-28`} />)}</div>
    </div>
  );
}
