"use client";
import { PantallaError } from "@/components/ui/PantallaError";

export default function ErrorTerminos({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError error={error} reset={reset} inicio="/" />;
}
