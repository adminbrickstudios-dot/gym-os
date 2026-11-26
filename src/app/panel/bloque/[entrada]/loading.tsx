// La forma real de una entrada con pestañas: la fila de pestañas arriba y la pantalla debajo (título, tarjetas, filas).
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="flex flex-wrap gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-11 w-32`} />)}</div>
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
    </div>
  );
}
