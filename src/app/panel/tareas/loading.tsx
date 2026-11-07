// Con la forma real de Para hacer hoy: título, automáticas, checklist, pestañas y tareas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-9 w-56`} />
      <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
      <div className={`${bloque} h-9 w-64`} />
      <div className="grid gap-2 md:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className={`${bloque} h-16`} />)}</div>
      <div className="flex flex-wrap gap-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className={`${bloque} h-11 w-36`} />)}</div>
      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
    </div>
  );
}
