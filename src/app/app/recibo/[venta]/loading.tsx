// Con la forma real del recibo en la app del socio.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-5 w-28`} />
      <div className={`${bloque} p-6 space-y-5`}>
        <div className="flex gap-4"><div className={`${bloque} h-14 w-14`} /><div className="flex-1 space-y-2"><div className={`${bloque} h-6 w-2/3`} /><div className={`${bloque} h-4 w-1/2`} /></div></div>
        <div className={`${bloque} h-16`} />
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className={`${bloque} h-8`} />)}</div>
        <div className={`${bloque} h-10 w-1/2 ml-auto`} />
      </div>
      <div className={`${bloque} h-12 w-full`} />
    </div>
  );
}
