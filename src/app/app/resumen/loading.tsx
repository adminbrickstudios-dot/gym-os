// Con la forma real de "Mi año": el título, la tarjeta del resumen y la grilla de insignias.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-12 w-2/3`} />
      <div className={`${bloque} h-32`} />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className={`${bloque} h-28`} />)}
      </div>
    </div>
  );
}
