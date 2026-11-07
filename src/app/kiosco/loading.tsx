// Con la forma real de la tablet: saludo, el campo del DNI y el teclado.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <main className="min-h-dvh grid place-items-center p-6" aria-busy="true" aria-label="Cargando">
      <div className="w-full max-w-md space-y-6">
        <div className={`${bloque} h-24`} />
        <div className={`${bloque} h-20`} />
        <div className="grid grid-cols-3 gap-3">{Array.from({ length: 12 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}</div>
      </div>
    </main>
  );
}
