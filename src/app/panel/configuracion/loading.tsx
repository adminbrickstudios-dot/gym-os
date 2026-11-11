// Con la forma real de Configuración: título, pestañas y el formulario de la pestaña.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-[44px] w-28 shrink-0`} />)}</div>
      <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-28`} />)}</div>
    </div>
  );
}
