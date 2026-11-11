// Con la forma real del asistente: título, barra de avance y los pasos.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-3 w-full`} />
      <div className="space-y-2">{Array.from({ length: 9 }).map((_, i) => <div key={i} className={`${bloque} h-[76px]`} />)}</div>
    </div>
  );
}
