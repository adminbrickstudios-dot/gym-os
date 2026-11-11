// Con la forma real: encabezado, los controles del registro, el botón de imprimir y la hoja A4.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-48 w-full max-w-2xl`} />
      <div className={`${bloque} h-12 w-56`} />
      <div className={`${bloque} w-full max-w-[30rem] aspect-[210/297]`} />
    </div>
  );
}
