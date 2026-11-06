// Con la forma real de una conversación: volver, título con estado, burbujas y el cuadro para contestar.
export default function Cargando() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className={`${bloque} h-6 w-32`} />
      <div className={`${bloque} h-14 w-2/3`} />
      <div className="space-y-3">
        <div className={`${bloque} h-20 w-4/5 ml-auto`} />
        <div className={`${bloque} h-24 w-4/5`} />
      </div>
      <div className={`${bloque} h-56`} />
    </div>
  );
}
