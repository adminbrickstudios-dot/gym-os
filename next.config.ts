import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app local para probar (scripts/local/levantar.sh) compila en .next-dev:
  // así `npm run build` (que usa .next) nunca le pisa los archivos mientras corre.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Logos y fotos se suben por una acción del servidor: hasta 2 MB por archivo
  // (lo decide la base) más lo que agrega el formulario.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
