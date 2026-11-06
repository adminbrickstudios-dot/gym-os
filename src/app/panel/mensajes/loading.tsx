// Con la forma real de Mensajes: título, pestañas de estado y la bandeja en filas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-11 w-28 flex-none`} />)}</div>
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
    </div>
  );
}
