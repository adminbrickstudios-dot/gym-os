// Con la forma real de Ayuda: el título, el buscador y las preguntas.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-14 w-1/2`} />
      <div className={`${bloque} h-12`} />
      <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bloque} h-14`} />)}</div>
    </div>
  );
}
