// Con la forma real del control: título, semana y tarjetas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="flex gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-[52px] w-36`} />)}</div>
      <div className="grid sm:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-24`} />)}</div>
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
    </div>
  );
}
