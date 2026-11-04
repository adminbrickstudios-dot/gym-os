import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app local para probar (scripts/local/levantar.sh) compila en .next-dev:
  // así `npm run build` (que usa .next) nunca le pisa los archivos mientras corre.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
