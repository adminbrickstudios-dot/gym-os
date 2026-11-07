import type { NextConfig } from "next";

// VD-25: las fotos del gimnasio (bucket público "marcas") pasan por el optimizador de imágenes de Next
// (tamaño y formato para cada celular). Solo desde el host de Supabase de este despliegue.
const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; } catch { return null; } })();

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
  // La app local para probar (scripts/local/levantar.sh) compila en .next-dev:
  // así `npm run build` (que usa .next) nunca le pisa los archivos mientras corre.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Logos y fotos se suben por una acción del servidor: hasta 2 MB por archivo
  // (lo decide la base) más lo que agrega el formulario.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // En desarrollo no mirar las copias de trabajo de los agentes ni las carpetas locales: cada archivo que cambiaban recompilaba toda la app.
  webpack: (config, { dev }) => {
    if (dev) config.watchOptions = { ...config.watchOptions, ignored: ["**/node_modules/**", "**/.git/**", "**/.claude/worktrees/**", "**/.local/**", "**/.next*/**"] };
    return config;
  },
};

export default nextConfig;
