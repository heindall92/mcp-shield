/** Seven ecosystem accents (Rosetta). Brand only: never used for danger / safe / warning. */
export const ACCENT_IDS = ['azul', 'rosa', 'solar', 'glaciar', 'orquidea', 'verde', 'rojo'] as const
export type Accent = (typeof ACCENT_IDS)[number]
