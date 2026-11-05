// http_ece (lo usa web-push por dentro): solo para la prueba de cifrado de PUSH-1.
declare module "http_ece" {
  export function decrypt(buffer: Buffer, params: { version: string; privateKey: unknown; authSecret: string }): Buffer;
  const ece: { decrypt: typeof decrypt };
  export default ece;
}
