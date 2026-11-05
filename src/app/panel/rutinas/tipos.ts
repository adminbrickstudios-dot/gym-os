export type Ejercicio = { id: string; nombre: string; grupo: string; video_url: string | null; activo: boolean };
export const GRUPOS: [string, string][] = [
  ["piernas", "🦵 Piernas"], ["gluteos", "🍑 Glúteos"], ["espalda", "🔙 Espalda"], ["pecho", "🫁 Pecho"], ["hombros", "🤷 Hombros"],
  ["brazos", "💪 Brazos"], ["core", "🎯 Core"], ["cardio", "❤️ Cardio"], ["completo", "🏋️ Cuerpo completo"], ["otro", "Otro"],
];
export const nombreGrupo = (g: string) => GRUPOS.find(([v]) => v === g)?.[1] ?? g;
