// Con la forma real del historial: título y tarjetas de turno.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-40`} />)}</div>
    </div>
  );
}
