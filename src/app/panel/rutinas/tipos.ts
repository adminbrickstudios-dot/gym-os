export type Ejercicio = { id: string; nombre: string; grupo: string; equipo?: string; video_url: string | null; activo: boolean };
export const GRUPOS: [string, string][] = [
  ["piernas", "Piernas"], ["gluteos", "Glúteos"], ["espalda", "Espalda"], ["pecho", "Pecho"], ["hombros", "Hombros"],
  ["brazos", "Brazos"], ["core", "Core"], ["cardio", "Cardio"], ["completo", "Cuerpo completo"], ["otro", "Otro"],
];
export const nombreGrupo = (g: string) => GRUPOS.find(([v]) => v === g)?.[1] ?? g;
/** VD-20: el equipo con el que se hace (para filtrar la biblioteca). */
export const EQUIPOS: [string, string][] = [
  ["barra", "Barra"], ["mancuernas", "Mancuernas"], ["maquina", "Máquina"], ["polea", "Polea"], ["peso_corporal", "Peso corporal"],
  ["kettlebell", "Kettlebell"], ["banda", "Banda elástica"], ["otro", "Otro"],
];
export const nombreEquipo = (e: string | undefined) => EQUIPOS.find(([v]) => v === e)?.[1] ?? "Otro";
