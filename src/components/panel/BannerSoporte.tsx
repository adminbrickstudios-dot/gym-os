/**
 * VD-40: cuando alguien de BRIK está adentro como Soporte, toda la pantalla lleva un marco de color y un cartel
 * con el motivo, el tiempo que le queda y la salida. Así nadie confunde esa sesión con la de la casa.
 */
export function BannerSoporte({ gimnasioId, gimnasio, motivo, minutos }: { gimnasioId: string; gimnasio: string; motivo: string; minutos: number }) {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] border-[6px] border-[#7c3aed]" data-soporte-marco />
      <div role="status" data-soporte-banner className="mb-6 pr-14 rounded-2xl bg-[#7c3aed] text-white px-4 py-3 space-y-2">
        <p className="font-semibold break-words">🧱 Estás dentro de {gimnasio} como Soporte BRIK</p>
        <p className="text-sm opacity-90 break-words">Motivo: {motivo} · te quedan {minutos} {minutos === 1 ? "minuto" : "minutos"}. El dueño ve esta entrada en su Control.</p>
        <form action="/admin/salir-gimnasio" method="post">
          <input type="hidden" name="gimnasio_id" value={gimnasioId} />
          <button className="boton !bg-white !text-[#7c3aed]">🚶 Salir</button>
        </form>
      </div>
    </>
  );
}
