// Codemod de un solo uso (BASE-6): emojis usados como ícono → <Icono nombre="..."/> y nombres de ícono en los datos. Se borra al terminar.
//   node scripts/tmp-emoji-a-icono.mjs <carpeta>... [--seco]
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*/gu;
const MAPA = {};
const poner = (nombre, ...lista) => lista.forEach((e) => { MAPA[e] = nombre; });
poner("alerta", "⚠");
poner("ok", "✅", "✔", "☑");
poner("cerrar", "❌", "✖");
poner("mas", "➕"); poner("menos", "➖");
poner("plata", "💵", "💲", "💸", "💰", "🪙");
poner("mensaje", "💬", "🗨");
poner("deshacer", "↩", "↪");
poner("etiqueta", "🏷");
poner("puerta", "🚪");
poner("regalo", "🎁");
poner("persona", "👤", "🙋", "🙂", "😕", "🧑", "👧", "🧒", "👍", "🙌", "🙈");
poner("usuarios", "👥", "🤝", "🧑‍🤝‍🧑", "👨‍👩‍👧", "👨‍👧");
poner("recibo", "🧾");
poner("prohibido", "🚫", "⛔", "🔕", "📴", "📵");
poner("reloj", "⏰", "⏱", "🕓", "🕐", "🕒", "🕘");
poner("reloj-arena", "⏳", "⌛");
poner("salir", "👋");
poner("lista", "📋", "📝");
poner("pesa", "💪", "🏋", "🥋", "🏃", "🚴", "🚶");
poner("repetir", "🔁", "🔄");
poner("tarjeta", "💳");
poner("camara", "📷", "📸");
poner("calendario", "🗓", "📅", "🎂");
poner("candado", "🔒", "🔐");
poner("candado-abierto", "🔓");
poner("celular", "📱", "📲");
poner("ticket", "🎟", "🎫");
poner("buscar", "🔍", "🔎");
poner("lapiz", "✏", "✍");
poner("estrella", "⭐", "★", "✨", "🎉", "🆕", "🏆".replace("🏆", "⭐"));
poner("trofeo", "🏆");
poner("llave", "🔑");
poner("ubicacion", "📍", "🗺", "🧭");
poner("ajustes", "⚙", "🛠", "🔧");
poner("web", "🌐");
poner("campana", "🔔", "🛎", "📣", "📢", "🔊", "🔇");
poner("calculadora", "🧮", "🔢", "➗");
poner("carrito", "🛒");
poner("ojo", "👀", "👁");
poner("caja", "📦", "🧱");
poner("chincheta", "📌");
poner("banco", "🏦");
poner("sede", "🏢");
poner("corazon", "🩺", "🩹", "💚");
poner("guardar", "💾");
poner("pausa", "⏸");
poner("escudo", "🛡");
poner("fuego", "🔥");
poner("alerta-circulo", "🚨", "🆘");
poner("ayuda", "❓", "❔");
poner("info", "ℹ", "💡");
poner("descargar", "⬇", "📥");
poner("subir", "⬆", "📤");
poner("documento", "📄", "📜", "📎");
poner("inicio", "🏠");
poner("grafico", "📊", "📐", "📏");
poner("tendencia", "📈"); poner("tendencia-baja", "📉");
poner("papelera", "🗑");
poner("objetivo", "🎯");
poner("corona", "👑");
poner("pantalla", "📺", "🖥");
poner("derecha", "▶", "↗");
poner("izquierda", "◀");
poner("menu", "☰");
poner("mail", "📧", "✉", "📨", "📬");
poner("enlace", "🔗");
poner("hoja", "🌱", "🌿");
poner("grilla", "🧩", "🔳", "🗂");
poner("rayo", "⚡");
poner("luna", "🌙");
poner("imagen", "🖼", "🎨");
poner("telefono", "📞");
poner("senal", "📶", "📡");
poner("persona", "🎓", "🧑‍🏫");
poner("punto-verde", "🟢"); poner("punto-amarillo", "🟡"); poner("punto-rojo", "🔴"); poner("punto-naranja", "🟠"); poner("punto-gris", "⚪");
poner("estrella", "🚀", "🎬");
const buscar = (e) => MAPA[e.replace(/️/g, "")] ?? null;
const SOLO_TEXTO = { "✅": "✓", "❌": "✗", "⚠": "!", "✓": "✓" };
const CLAVES_ICONO = new Set(["emoji", "e", "ico", "icono"]);
const TAGS_ICONO = new Set(["Encabezado", "Vacio", "Tarjeta", "Chip", "Boton", "Aviso", "PantallaError"]);

const tieneEmoji = (t) => { EMOJI.lastIndex = 0; return EMOJI.test(t); };
const quitarEmojis = (t) => t.replace(new RegExp(`${EMOJI.source}[ \\u00a0]?`, "gu"), "");

function esRefEmoji(n) {
  if (ts.isParenthesizedExpression(n)) return esRefEmoji(n.expression);
  if (ts.isPropertyAccessExpression(n)) return CLAVES_ICONO.has(n.name.text);
  if (ts.isIdentifier(n)) return CLAVES_ICONO.has(n.text);
  if (ts.isElementAccessExpression(n)) return ts.isIdentifier(n.expression) && /EMOJI|ICONO/i.test(n.expression.text);
  if (ts.isBinaryExpression(n) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(n.operatorToken.kind)) return esRefEmoji(n.left);
  return false;
}

function procesar(archivo) {
  const original = fs.readFileSync(archivo, "utf8");
  if (!tieneEmoji(original)) return null;
  const sf = ts.createSourceFile(archivo, original, ts.ScriptTarget.Latest, true, archivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const ediciones = [];
  let usaIcono = false;
  const editar = (ini, fin, texto) => ediciones.push([ini, fin, texto]);

  const reemplazoLiteralCrudo = (crudo, bajoClaveIcono) => {
    const solo = crudo.replace(/^[`'"]|[`'"]$/g, "").trim();
    EMOJI.lastIndex = 0;
    const m = solo.match(new RegExp(`^${EMOJI.source}$`, "u"));
    if (m) {
      const nombre = buscar(solo);
      const q = crudo[0];
      if (bajoClaveIcono) return `${q}${nombre ?? ""}${q}`;
      const t = SOLO_TEXTO[solo.replace(/️/g, "")];
      return `${crudo[0]}${t ?? ""}${crudo[0]}`;
    }
    return quitarEmojis(crudo);
  };

  const visitar = (n) => {
    if (ts.isJsxText(n)) {
      const t = n.getText();
      if (!tieneEmoji(t)) return;
      let salida = "", ultimo = 0;
      for (const m of t.matchAll(new RegExp(EMOJI.source, "gu"))) {
        salida += t.slice(ultimo, m.index);
        ultimo = m.index + m[0].length;
        const nombre = buscar(m[0]);
        if (nombre) { salida += `<Icono nombre="${nombre}" />`; usaIcono = true; }
        else if (t[ultimo] === " ") ultimo++;
      }
      salida += t.slice(ultimo);
      editar(n.getStart(), n.getEnd(), salida);
      return;
    }
    if (ts.isJsxAttribute(n)) {
      const nombre = n.name.getText();
      const tag = n.parent?.parent && (ts.isJsxOpeningElement(n.parent.parent) || ts.isJsxSelfClosingElement(n.parent.parent)) ? n.parent.parent.tagName.getText() : "";
      if (nombre === "emoji" && TAGS_ICONO.has(tag)) {
        editar(n.name.getStart(), n.name.getEnd(), "icono");
        const ini = n.initializer;
        if (ini && ts.isStringLiteral(ini)) {
          const nom = buscar(ini.text.trim());
          editar(ini.getStart(), ini.getEnd(), `"${nom ?? ""}"`);
          return;
        }
        if (ini && ts.isJsxExpression(ini) && ini.expression) {
          const ex = ini.expression;
          if (ts.isStringLiteral(ex) || ts.isNoSubstitutionTemplateLiteral(ex)) {
            const nom = buscar(ex.text.trim());
            editar(ex.getStart(), ex.getEnd(), `"${nom ?? ""}"`);
            return;
          }
          if (ts.isConditionalExpression(ex) || ts.isBinaryExpression(ex)) {
            ts.forEachChild(ex, (h) => { if ((ts.isStringLiteral(h) || ts.isNoSubstitutionTemplateLiteral(h)) && tieneEmoji(h.getText())) editar(h.getStart(), h.getEnd(), `"${buscar(h.text.trim()) ?? ""}"`); });
            // también cuando el literal está más adentro:
            const hojas = [];
            const rec = (x) => { if ((ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) && tieneEmoji(x.getText())) hojas.push(x); ts.forEachChild(x, rec); };
            rec(ex);
            for (const h of hojas) if (!ediciones.some(([a]) => a === h.getStart())) editar(h.getStart(), h.getEnd(), `"${buscar(h.text.trim()) ?? ""}"`);
            return;
          }
        }
      }
    }
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)) && esRefEmoji(n.expression)) {
      let ex = n.expression;
      let texto = ex.getText();
      const hojas = [];
      const rec = (x) => { if ((ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) && tieneEmoji(x.getText())) hojas.push(x); ts.forEachChild(x, rec); };
      rec(ex);
      for (const h of hojas.reverse()) {
        const rel = [h.getStart() - ex.getStart(), h.getEnd() - ex.getStart()];
        texto = texto.slice(0, rel[0]) + `"${buscar(h.text.trim()) ?? ""}"` + texto.slice(rel[1]);
      }
      usaIcono = true;
      editar(n.getStart(), n.getEnd(), `<Icono nombre={${texto}} />`);
      return;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const crudo = n.getText();
      if (!tieneEmoji(crudo)) return;
      const padre = n.parent;
      const clave = ts.isPropertyAssignment(padre) && padre.initializer === n && (ts.isIdentifier(padre.name) || ts.isStringLiteral(padre.name)) ? padre.name.text : null;
      const bajoClave = clave !== null && CLAVES_ICONO.has(clave);
      editar(n.getStart(), n.getEnd(), (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) ? quitarEmojis(crudo) : reemplazoLiteralCrudo(crudo, bajoClave));
      return;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  // Aplicar de atrás hacia adelante, sin superposiciones.
  ediciones.sort((a, b) => b[0] - a[0]);
  let salida = original, limite = Infinity;
  for (const [ini, fin, texto] of ediciones) {
    if (fin > limite) continue;
    salida = salida.slice(0, ini) + texto + salida.slice(fin);
    limite = ini;
  }
  // Lo que quede (comentarios y demás): se saca.
  salida = quitarEmojis(salida);
  if (usaIcono && !/import\s*\{[^}]*\bIcono\b[^}]*\}\s*from/.test(salida)) {
    const sf2 = ts.createSourceFile(archivo, salida, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imports = sf2.statements.filter(ts.isImportDeclaration);
    const linea = `import { Icono } from "@/components/ui/Icono";\n`;
    if (imports.length) { const fin = imports[imports.length - 1].getEnd(); salida = salida.slice(0, fin) + "\n" + linea.trimEnd() + salida.slice(fin); }
    else { const m = salida.match(/^(\s*"use (?:client|server)";\s*\n)/); salida = m ? m[1] + linea + salida.slice(m[1].length) : linea + salida; }
  }
  return salida === original ? null : salida;
}

const args = process.argv.slice(2);
const seco = args.includes("--seco");
let cambiados = 0;
const recorrer = (d) => {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) recorrer(p);
    else if ((p.endsWith(".tsx")) && !/\.test\./.test(p)) {
      const s = procesar(p);
      if (s !== null) { cambiados++; if (!seco) fs.writeFileSync(p, s); }
    }
  }
};
for (const d of args.filter((a) => !a.startsWith("--"))) recorrer(d);
console.log(`archivos cambiados: ${cambiados}${seco ? " (seco)" : ""}`);
