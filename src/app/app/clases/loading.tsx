// Con la forma real de las clases: volver, el título, los días y la lista.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-5 w-20`} />
      <div className={`${bloque} h-14 w-2/3`} />
      <div className="flex gap-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`${bloque} h-11 w-20 flex-none`} />)}</div>
      {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${bloque} h-16`} />)}
    </div>
  );
}
