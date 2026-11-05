// Con la forma real de la Entrada: título, buscador grande y la lista de hoy.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-16`} />
      <div className={`${bloque} h-8 w-24`} />
      <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-14`} />)}</div>
    </div>
  );
}
