// Raíz de la plataforma. En S0 alcanza con que responda: confirma que la
// cadena dominio → Vercel → Next funciona. La landing de BRIK viene después.
export default function Inicio() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl mb-4" aria-hidden>🏋️</p>
        <h1 className="text-3xl font-semibold">Gym OS</h1>
        <p className="texto-suave mt-2">Sistema de gestión para gimnasios.</p>
      </div>
    </main>
  );
}
