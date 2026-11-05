// Con la forma real de la bandeja: título, un grupo y sus filas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-8 w-48`} />
      <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-28`} />)}</div>
    </div>
  );
}
