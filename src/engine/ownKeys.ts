/**
 * Server names, env vars and header names come from untrusted input and may be "__proto__",
 * "constructor" or any other Object.prototype name. JSON.parse keeps them as own keys, so an MCP
 * client launches those servers. A plain `o[k] = v` with k = "__proto__" sets the prototype instead
 * (the server would vanish from the audit) and a plain `o[k]` read returns inherited members. These
 * helpers only write and read own data properties.
 */
export function setOwn<T>(o: Record<string, T>, k: string, v: T): void {
  Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true })
}
export const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k)
export const getOwn = <T>(o: Record<string, T>, k: string): T | undefined => (hasOwn(o, k) ? o[k] : undefined)
