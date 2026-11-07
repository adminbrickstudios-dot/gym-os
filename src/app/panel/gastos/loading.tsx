// Con la forma real de Gastos: título, meses, la ganancia, el formulario y la lista.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="flex gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-10 w-24`} />)}</div>
      <div className={`${bloque} h-28`} />
      <div className={`${bloque} h-40`} />
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-14`} />)}</div>
    </div>
  );
}
