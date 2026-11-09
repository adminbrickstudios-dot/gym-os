import { describe, expect, it } from "vitest";
import { crc32, csv, zip } from "./zip";

describe("zip mínimo", () => {
  it("crc32 conocido", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("arma un zip con la firma y las entradas", () => {
    const z = zip([{ nombre: "socios.csv", contenido: new TextEncoder().encode("a,b\r\n1,2\r\n") }, { nombre: "pagos.csv", contenido: new TextEncoder().encode("x\r\n") }]);
    const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
    expect(new TextDecoder().decode(z)).toContain("socios.csv");
  });
  it("csv escapa y neutraliza fórmulas", () => {
    expect(csv([{ n: "Ana, la \"jefa\"", f: "=1+1" }])).toBe('﻿n,f\r\n"Ana, la ""jefa""",\'=1+1\r\n');
    expect(csv([])).toBe("﻿\r\n");
  });
});
