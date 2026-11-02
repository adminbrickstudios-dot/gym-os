// Con la forma real del inicio: saludo, grilla, números y lista.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-16 w-3/4`} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bloque} aspect-[4/3] sm:aspect-[5/3]`} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}
      </div>
      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-[68px]`} />)}</div>
    </div>
  );
}
