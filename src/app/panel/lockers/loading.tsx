// Con la forma real de Lockers: encabezado, los totales y las tarjetas de los lockers.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="grid grid-cols-3 gap-3 max-w-3xl">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
      <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bloque} h-28`} />)}</div>
    </div>
  );
}
