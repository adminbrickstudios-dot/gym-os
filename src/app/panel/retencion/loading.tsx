// Con la forma real de Retención: título, la plata en riesgo, las listas y una fila por socio.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-24`} />)}</div>
    </div>
  );
}
