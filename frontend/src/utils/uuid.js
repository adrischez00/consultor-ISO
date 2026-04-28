const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUuidOrNull(value) {
  const normalized = String(value ?? "").trim();
  if (!UUID_REGEX.test(normalized)) {
    return null;
  }
  return normalized.toLowerCase();
}

export function ensureUuid(value, fieldName) {
  const normalized = normalizeUuidOrNull(value);
  if (!normalized) {
    throw new Error(`${fieldName} inválido: debe ser UUID.`);
  }
  return normalized;
}
