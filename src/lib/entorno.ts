// Variables de entorno con error claro si faltan: nunca un undefined
// que explota tres pantallas después.

export function requerir(nombre: string, valor: string | undefined): string {
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Ver .env.local.example.`);
  return valor;
}

// Las NEXT_PUBLIC_* se leen con su nombre literal para que Next las inline.
export const supabaseUrl = () => requerir("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnon = () => requerir("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
