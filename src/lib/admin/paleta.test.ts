import { describe, expect, it } from "vitest";
import { filtrarComandos, type Comando } from "./paleta";

const cs: Comando[] = [
  { texto: "Crear gimnasio", destino: "/admin#alta", clave: "alta nuevo" },
  { texto: "Entrar a Olympo como soporte", destino: "/admin/1#entrar", clave: "entrar soporte olympo" },
  { texto: "Abrir la ficha de Olímpico", destino: "/admin/2", clave: "olimpico ficha" },
];
describe("paleta de Ctrl+K", () => {
  it("sin texto devuelve todo", () => expect(filtrarComandos(cs, "  ")).toHaveLength(3));
  it("ignora tildes y mayúsculas", () => expect(filtrarComandos(cs, "OLIMPICO").map((c) => c.destino)).toEqual(["/admin/2"]));
  it("todas las palabras tienen que estar", () => {
    expect(filtrarComandos(cs, "entrar olympo").map((c) => c.destino)).toEqual(["/admin/1#entrar"]);
    expect(filtrarComandos(cs, "crear olympo")).toEqual([]);
  });
});
