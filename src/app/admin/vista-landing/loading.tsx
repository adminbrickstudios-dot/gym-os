/** La forma real: la barra de la llave y el arriba de la página de venta. */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 space-y-10" aria-busy="true" aria-label="Cargando la vista previa">
      <div className="h-11 w-72 rounded-xl bg-[var(--superficie-2,var(--borde))]" />
      <div className="h-40 w-full max-w-xl rounded-2xl bg-[var(--superficie-2,var(--borde))]" />
      <div className="h-16 w-64 rounded-xl bg-[var(--superficie-2,var(--borde))]" />
    </div>
  );
}
