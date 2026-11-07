// Con la forma real del formulario del socio: título y campos de a dos.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-8 max-w-2xl" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-[52px]`} />)}</div>
      ))}
      <div className={`${bloque} h-[52px] w-48`} />
    </div>
  );
}
