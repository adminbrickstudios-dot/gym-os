// Con la forma real del reglamento aceptado: título y el texto.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-6 max-w-2xl" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-5 w-32`} />
      <div className={`${bloque} h-16 w-3/4`} />
      <div className={`${bloque} h-64`} />
    </div>
  );
}
