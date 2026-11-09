// Un zip mínimo (sin compresión) para exportar un gimnasio: un CSV por lista. Sin dependencias.

const TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Arma un zip (método "stored") con los archivos dados. */
export function zip(archivos: { nombre: string; contenido: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const crc = crc32(a.contenido);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // 0x0800: nombres en UTF-8
    local.setUint32(14, crc, true); local.setUint32(18, a.contenido.length, true); local.setUint32(22, a.contenido.length, true); local.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(local.buffer), nombre, a.contenido);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, a.contenido.length, true); c.setUint32(24, a.contenido.length, true); c.setUint16(28, nombre.length, true); c.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(c.buffer), nombre);
    desplazamiento += 30 + nombre.length + a.contenido.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplazamiento, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of todo) { salida.set(p, o); o += p.length; }
  return salida;
}

const celda = (v: unknown) => {
  let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Una lista de objetos como CSV (con BOM para Excel). */
export function csv(filas: Record<string, unknown>[]): string {
  if (filas.length === 0) return "﻿\r\n";
  const cols = Object.keys(filas[0]);
  return "﻿" + [cols.join(","), ...filas.map((f) => cols.map((c) => celda(f[c])).join(","))].join("\r\n") + "\r\n";
}
