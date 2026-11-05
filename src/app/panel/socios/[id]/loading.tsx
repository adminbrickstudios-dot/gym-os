// Con la forma real de la ficha: foto y nombre, estado, botones, pestañas y tarjetas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center gap-4"><div className={`${bloque} size-16 sm:size-20 flex-none`} /><div className={`${bloque} h-14 w-2/3`} /></div>
      <div className={`${bloque} h-8 w-64`} />
      <div className="flex flex-wrap gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-[52px] w-32`} />)}</div>
      <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-11 w-28`} />)}</div>
      <div className="grid sm:grid-cols-2 gap-3"><div className={`${bloque} h-64`} /><div className={`${bloque} h-64`} /></div>
    </div>
  );
}
