// Con la forma real de Documentos: título y tres tarjetas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="flex flex-wrap gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-11 w-36`} />)}</div>
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-32`} />)}</div>
    </div>
  );
}
