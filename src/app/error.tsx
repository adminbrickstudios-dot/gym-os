"use client";
import { PantallaError } from "@/components/ui/PantallaError";

export default function ErrorGeneral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen p-6 flex items-center justify-center"><PantallaError error={error} reset={reset} inicio="/" /></main>;
}
