"use client";
import { createBrowserClient } from "@supabase/ssr";

// Cliente para Client Components. Lee las NEXT_PUBLIC_* inlineadas en el build.
export function crearClienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el build.");
  return createBrowserClient(url, anon);
}
