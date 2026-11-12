// Z7 · "Hay una versión nueva": dice qué publicación está respondiendo (el commit o el despliegue). El navegador lo compara con el que tenía al abrir.
// Pública y sin datos de nadie, y barata (no toca la base): se puede preguntar cada unos minutos.
export const dynamic = "force-dynamic";

export function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? null;
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
