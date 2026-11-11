// Con la forma real de una guía: encabezado, el botón de imprimir y la hoja con sus pasos.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-12 w-56`} />
      <div className="space-y-4 max-w-3xl">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-24`} />)}</div>
    </div>
  );
}
