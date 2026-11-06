// Con la forma real del inicio de la app: el saludo, el semáforo grande y las clases.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-6 w-40`} />
      <div className="rounded-[var(--radio-grande)] bg-[var(--tarjeta)] esqueleto h-56" />
      <div className="grid grid-cols-2 gap-3"><div className={`${bloque} h-24`} /><div className={`${bloque} h-24`} /></div>
      <div className={`${bloque} h-10 w-1/2`} />
      <div className={`${bloque} h-16`} />
    </div>
  );
}
