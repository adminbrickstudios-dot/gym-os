// Con la forma real: el encabezado y las tarjetas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-12 w-1/2`} />
      <div className={`${bloque} h-5 w-2/3`} />
      {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${bloque} h-20`} />)}
    </div>
  );
}
