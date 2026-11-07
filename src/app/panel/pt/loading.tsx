// Con la forma real de Personal trainer: encabezado, los bloques de carga y la agenda por día.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-14 max-w-3xl`} />
      <div className="space-y-3 max-w-3xl">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
    </div>
  );
}
