// PUSH-1: lo que manda el servidor es lo que un navegador puede abrir. Se arma
// un "navegador" con sus claves (como las que da pushManager.subscribe), se
// genera el pedido con web-push y se descifra del lado del navegador.
import { createECDH, createPublicKey, randomBytes, verify } from "node:crypto";
import ece from "http_ece";
import webpush from "web-push";
import { describe, expect, it } from "vitest";

const b64u = (b: Buffer) => b.toString("base64url");

describe("web push", () => {
  it("cifra el mensaje para ese dispositivo y firma con la clave VAPID propia", () => {
    const vapid = webpush.generateVAPIDKeys();
    const navegador = createECDH("prime256v1");
    navegador.generateKeys();
    const auth = randomBytes(16);
    const sub = { endpoint: "https://push.ejemplo.invalid/abc", keys: { p256dh: b64u(navegador.getPublicKey()), auth: b64u(auth) } };
    const mensaje = { titulo: "🏦 Lucía mandó un comprobante", cuerpo: "$15.000 para revisar", url: "/panel/transferencias" };
    const pedido = webpush.generateRequestDetails(sub, JSON.stringify(mensaje), {
      TTL: 86400, urgency: "normal", vapidDetails: { subject: "mailto:avisos@ejemplo.invalid", publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    });
    expect(pedido.method).toBe("POST");
    expect(pedido.headers["Content-Encoding"]).toBe("aes128gcm");
    // El navegador lo abre con su clave privada y su secreto.
    const claro = ece.decrypt(pedido.body as Buffer, { version: "aes128gcm", privateKey: navegador, authSecret: b64u(auth) });
    expect(JSON.parse(claro.toString("utf8"))).toEqual(mensaje);
    // La firma VAPID es de nuestra clave pública (sin ella, el servicio de push lo rechaza).
    const [, jwt, k] = String(pedido.headers.Authorization).match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(vapid.publicKey);
    const [h, p, firma] = jwt.split(".");
    const crudo = Buffer.from(vapid.publicKey, "base64url");
    const jwk = { kty: "EC", crv: "P-256", x: b64u(crudo.subarray(1, 33)), y: b64u(crudo.subarray(33, 65)) };
    const ok = verify("sha256", Buffer.from(`${h}.${p}`), { key: createPublicKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(firma, "base64url"));
    expect(ok).toBe(true);
    expect(JSON.parse(Buffer.from(p, "base64url").toString()).aud).toBe("https://push.ejemplo.invalid");
  });
});
