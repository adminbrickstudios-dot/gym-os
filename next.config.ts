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
  // Next 16 compila con Turbopack. La raíz es el proyecto (hay otro package-lock.json más arriba, en la carpeta del usuario).
  turbopack: { root: process.cwd() },
};

export default nextConfig;
