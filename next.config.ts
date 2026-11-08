import type { NextConfig } from "next";

// VD-25: las fotos del gimnasio (bucket público "marcas") pasan por el optimizador de imágenes de Next
// (tamaño y formato para cada celular). Solo desde el host de Supabase de este despliegue.
const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; } catch { return null; } })();

// BASE-8 · Encabezados de seguridad en todas las rutas. La CSP deja correr lo inline que Next necesita y limita de dónde puede
// venir el resto; la cámara queda permitida solo para este sitio (lector de QR).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://sdk.mercadopago.com https://http2.mlstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");
const ENCABEZADOS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  async headers() { return [{ source: "/:path*", headers: ENCABEZADOS }]; },
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
