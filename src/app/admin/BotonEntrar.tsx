// Entrar al panel de un gimnasio como Soporte BRIK (POST: la base valida y lo suma al equipo).
export function BotonEntrar({ gimnasioId, principal = true, texto = "🚪 Entrar al panel" }: { gimnasioId: string; principal?: boolean; texto?: string }) {
  return (
    <form action="/admin/entrar" method="post">
      <input type="hidden" name="gimnasio_id" value={gimnasioId} />
      <button className={`boton ${principal ? "boton-principal" : ""}`}>{texto}</button>
    </form>
  );
}
