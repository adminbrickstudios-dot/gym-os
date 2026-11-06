// Con la forma real del formulario: volver, título, los cuatro motivos, el mensaje y el botón.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-6 w-24`} />
      <div className={`${bloque} h-14 w-2/3`} />
      <div className="tarjeta p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-[52px]`} />)}</div>
        <div className={`${bloque} h-32`} />
        <div className={`${bloque} h-[52px]`} />
        <div className={`${bloque} h-14`} />
      </div>
    </div>
  );
}
