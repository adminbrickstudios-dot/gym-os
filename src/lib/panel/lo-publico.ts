// VD-47: las escrituras (funciones de la base) que cambian lo que ve la gente en la página del gimnasio:
// marca, planes y su orden, secciones, horarios, clases de la semana, sedes, eventos, y lo que hace el super admin
// (dirección, pausa, módulos, plantillas). Cuando una de estas corre, lib/panel/servidor.ts invalida la etiqueta
// "landing" al instante. Invalidar de más cuesta una consulta; de menos hace que alguien cambie algo y no lo vea
// por hasta 60 s.
const PREFIJOS = "guardar|publicar|programar|aplicar|anular_precio|anular_cierre|crear_cierre|confirmar_imagen|quitar_imagen|ordenar_fotos|ordenar_planes|sumar_sede|configurar|archivar|reordenar|activar|desactivar|apagar|prender|editar|agregar_horario|cerrar_horario|cancelar_clase|crear_evento|cerrar_evento";
const SUPER_ADMIN = "admin_(guardar_marca|guardar_modulos|guardar_tipo_gimnasio|guardar_ciudad|agregar_dominio|quitar_dominio|cambiar_slug|aplicar_plantilla|clonar_configuracion|crear_gimnasio|crear_demo|pausar_gimnasio|reanudar_gimnasio|dar_de_baja|restaurar_baja|borrar_definitivo|borrar_demos_vencidas|prender_funcion|guardar_plantilla_texto|restaurar_plantilla_texto|restaurar_texto_gimnasio)";
const GUARDA_LO_PUBLICO = new RegExp(`^((${PREFIJOS})(_|$)|${SUPER_ADMIN}$)`);

/** ¿Esta escritura de la base cambia algo que la página pública tiene guardado en caché? */
export const guardaLoPublico = (nombreRpc: string): boolean => GUARDA_LO_PUBLICO.test(nombreRpc);
