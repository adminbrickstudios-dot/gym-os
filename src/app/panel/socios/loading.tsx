// Con la forma real de Socios: título, búsqueda, píldoras y filas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-14`} />
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bloque} h-11 w-32 flex-none`} />)}</div>
      <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className={`${bloque} h-[68px]`} />)}</div>
    </div>
  );
}
