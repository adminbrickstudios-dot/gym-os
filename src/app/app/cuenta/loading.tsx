// Con la forma real de la página: título y los formularios.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} size-16`} />
      <div className={`${bloque} h-14 w-3/4`} />
      <div className={`${bloque} h-6 w-2/3`} />
    </div>
  );
}
