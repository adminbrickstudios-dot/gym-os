// Con la forma real de la página: volver, título y la lista de planes.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-6 w-20`} />
      <div className="space-y-2">
        <div className={`${bloque} h-14 w-1/2`} />
        <div className={`${bloque} h-6 w-3/4`} />
      </div>
      <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className={`${bloque} h-[68px]`} />)}</div>
    </div>
  );
}
