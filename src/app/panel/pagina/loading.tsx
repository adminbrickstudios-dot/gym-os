// Con la forma real de Tu página: estado, editor a la izquierda y la página a la derecha.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-48`} />)}</div>
        <div className={`${bloque} hidden lg:block h-[70dvh]`} />
      </div>
    </div>
  );
}
