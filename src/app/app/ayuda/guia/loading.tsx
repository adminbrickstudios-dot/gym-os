// Con la forma real de la guía del socio: título, botón de imprimir y los pasos.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-14 w-2/3`} />
      <div className={`${bloque} h-12 w-48`} />
      <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-24`} />)}</div>
    </div>
  );
}
