// Con la forma real de Ayuda: encabezado, el buscador y las preguntas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-24 w-2/3`} />
      <div className={`${bloque} h-12 max-w-3xl`} />
      <div className="space-y-2 max-w-3xl">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bloque} h-14`} />)}</div>
    </div>
  );
}
