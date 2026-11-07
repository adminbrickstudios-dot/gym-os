// Con la forma real: título, meses, la tarjeta de configuración y una fila por persona.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="flex gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-10 w-24`} />)}</div>
      <div className={`${bloque} h-28 max-w-xl`} />
      <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
    </div>
  );
}
