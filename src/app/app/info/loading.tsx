// Con la forma real de Info del gimnasio: el título y las tarjetas de horarios, contacto y reglamento.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-14 w-2/3`} />
      <div className={`${bloque} h-48`} />
      <div className={`${bloque} h-20`} />
      <div className={`${bloque} h-16`} />
    </div>
  );
}
