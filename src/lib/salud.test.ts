import { describe, expect, test } from "vitest";
import { AVISO_REESCRIBIR, detectarSalud, errorSiHaySalud } from "./salud";

describe("detectarSalud (VD-46H)", () => {
  test("detecta lo evidente", () => {
    expect(detectarSalud("operado de rodilla")).not.toBeNull();
    expect(detectarSalud("Tiene diabetes")).not.toBeNull();
    expect(detectarSalud("tiene DIABETES tipo 2")).not.toBeNull();
    expect(detectarSalud("Me duele la espalda")).not.toBeNull();
    expect(detectarSalud("viene de una cirugía de hombro")).not.toBeNull();
    expect(detectarSalud("está embarazada")).not.toBeNull();
  });
  test("no se asusta de lo cotidiano", () => {
    expect(detectarSalud("operación de caja")).toBeNull();
    expect(detectarSalud("Prefiere el turno mañana, viene con la hermana")).toBeNull();
    expect(detectarSalud("viaje a Bariloche por trabajo")).toBeNull();
    expect(detectarSalud("quiere bajar de peso y entrenar con pesas")).toBeNull();
    expect(detectarSalud("")).toBeNull();
    expect(detectarSalud(null)).toBeNull();
  });
  test("el error del servidor", () => {
    expect(errorSiHaySalud("hola", "operado de rodilla")).toBe(AVISO_REESCRIBIR);
    expect(errorSiHaySalud("hola", undefined)).toBeNull();
  });
});
