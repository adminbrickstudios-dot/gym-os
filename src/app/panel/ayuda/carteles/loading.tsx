// Con la forma real de Carteles: encabezado y las tres filas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="space-y-3 max-w-3xl">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-24`} />)}</div>
    </div>
  );
}
