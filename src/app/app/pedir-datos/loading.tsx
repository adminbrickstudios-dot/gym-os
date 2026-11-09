// Con la forma real: título, texto y el formulario con sus tres opciones.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-12 w-2/3`} />
      <div className={`${bloque} h-16`} />
      <div className={`${bloque} h-48`} />
    </div>
  );
}
