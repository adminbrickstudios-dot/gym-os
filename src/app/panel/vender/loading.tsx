// Con la forma real de Vender: buscador, botones de lo que se vende y el ticket al costado.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8">
        <div className="space-y-6">
          <div className={`${bloque} h-14`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bloque} h-[104px]`} />)}</div>
        </div>
        <div className={`${bloque} h-80`} />
      </div>
    </div>
  );
}
