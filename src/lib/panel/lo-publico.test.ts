import { describe, expect, it } from "vitest";
import { guardaLoPublico } from "./lo-publico";

describe("qué escrituras invalidan la caché de la página pública", () => {
  it.each([
    "guardar_pagina", "guardar_plan", "guardar_regla_plan", "publicar_pagina", "aplicar_aumento",
    "ordenar_planes", "agregar_horario", "cerrar_horario", "editar_horario", "cancelar_clase",
    "crear_evento", "cerrar_evento", "admin_pausar_gimnasio", "admin_agregar_dominio", "admin_cambiar_slug", "admin_guardar_modulos",
    "admin_guardar_marca", "admin_aplicar_plantilla", "sumar_sede", "anular_cierre", "crear_cierre", "ordenar_fotos",
  ])("%s invalida", (n) => expect(guardaLoPublico(n)).toBe(true));

  it.each([
    "cobrar", "registrar_pago", "buscar_socios", "configuracion_panel", "clases_del_dia", "planes_gimnasio",
    "agregar_horarios_de_prueba", "cerrar_caja", "admin_tablero", "admin_agregar_nota", "admin_gimnasios",
  ])("%s no invalida", (n) => expect(guardaLoPublico(n)).toBe(false));
});
