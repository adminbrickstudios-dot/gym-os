import { expect, test } from "vitest";
import { linkCompartir, textoCierre } from "./caja";

test("cierre con faltante, retiro y otros medios", () => {
  const t = textoCierre({ caja: "Caja principal", cuando: "mié 05/11 08:00 a 14:00", abrio: "Ana", cerro: "Ana", monto_inicial: 2000, efectivo: 0,
    ingresos: 0, retiros: 500, esperado: 1500, contado: 1400, diferencia: -100, otros_medios: { transferencia: 25000 }, nota: "Faltan 100" });
  expect(t).toBe("🔒 Cierre de caja · Caja principal · mié 05/11 08:00 a 14:00\nAbrió Ana · cerró Ana\nInicial $2.000 · Efectivo cobrado $0 · Salió $500\n"
    + "Tenía que haber $1.500 · Contado $1.400\n⚠️ Faltaron $100\nAdemás: Transferencia $25.000\nNota: Faltan 100");
  expect(linkCompartir("a b")).toBe("https://wa.me/?text=a%20b");
});
