function parseBooleanValue(rawValue) {
  if (typeof rawValue === "boolean") return rawValue;
  if (rawValue == null) return null;
  const normalized = String(rawValue).trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
}

function normalizeListValue(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (rawValue == null) return [];
  return String(rawValue)
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonValue(rawValue) {
  if (rawValue == null) return "";
  if (typeof rawValue === "object") return rawValue;
  const text = String(rawValue).trim();
  if (!text) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractRawItemValue(item) {
  if (item?.value_json != null) return item.value_json;
  return item?.value_text ?? "";
}

function normalizeNumberValue(rawValue) {
  if (rawValue == null || rawValue === "") return "";
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : "";
}

function hasFilledValue(field, value) {
  if (field.type === "boolean") return typeof value === "boolean";
  if (field.type === "number") return value !== "" && value != null;
  if (field.type === "list") return Array.isArray(value) && value.length > 0;
  if (field.type === "json") {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return String(value).trim().length > 0;
  }
  return String(value ?? "").trim().length > 0;
}

function fieldValueToItemPayload(field, value, sortOrder) {
  const base = {
    item_code: field.field_code,
    item_label: field.label,
    sort_order: sortOrder,
    value_text: null,
    value_json: null,
  };

  if (field.type === "boolean") {
    if (typeof value !== "boolean") return null;
    return { ...base, value_text: value ? "true" : "false" };
  }

  if (field.type === "number") {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return { ...base, value_text: String(parsed) };
  }

  if (field.type === "list") {
    const normalized = normalizeListValue(value);
    if (normalized.length === 0) return null;
    return { ...base, value_json: normalized };
  }

  if (field.type === "json") {
    if (value == null || value === "") return null;
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        return { ...base, value_json: value };
      }
      if (Object.keys(value).length === 0) return null;
      return { ...base, value_json: value };
    }
    const rawText = String(value).trim();
    if (!rawText) return null;
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? { ...base, value_json: parsed } : null;
      }
      if (typeof parsed === "object" && parsed !== null) {
        return Object.keys(parsed).length > 0 ? { ...base, value_json: parsed } : null;
      }
      return { ...base, value_text: rawText };
    } catch {
      return { ...base, value_text: rawText };
    }
  }

  const normalizedText = String(value ?? "").trim();
  if (!normalizedText) return null;
  return { ...base, value_text: normalizedText };
}

export function buildGuidedValuesFromItems(sectionDefinition, items) {
  const values = {};
  const fields = sectionDefinition?.flat_fields || [];
  const itemMap = new Map(
    (Array.isArray(items) ? items : []).map((item) => [String(item.item_code || "").trim(), item])
  );

  fields.forEach((field) => {
    const item = itemMap.get(field.field_code);
    const rawValue = extractRawItemValue(item);

    if (field.type === "boolean") {
      values[field.field_code] = parseBooleanValue(rawValue);
      return;
    }
    if (field.type === "number") {
      values[field.field_code] = normalizeNumberValue(rawValue);
      return;
    }
    if (field.type === "list") {
      values[field.field_code] = normalizeListValue(rawValue);
      return;
    }
    if (field.type === "json") {
      values[field.field_code] = parseJsonValue(rawValue);
      return;
    }
    values[field.field_code] = rawValue == null ? "" : String(rawValue);
  });

  return values;
}

export function extractLegacyItems(sectionDefinition, items) {
  const knownCodes = new Set(
    (sectionDefinition?.flat_fields || []).map((field) => String(field.field_code || "").trim())
  );
  const normalizedSectionCode = String(sectionDefinition?.section_code || "").trim();
  const shouldDropLegacyItems = normalizedSectionCode === "6" || normalizedSectionCode === "9";

  return (Array.isArray(items) ? items : []).filter((item) => {
    const code = String(item.item_code || "").trim();
    if (!code || knownCodes.has(code)) return false;
    if (shouldDropLegacyItems) return false;
    return true;
  });
}

export function buildItemsFromGuidedValues(sectionDefinition, valuesByFieldCode, legacyItems = []) {
  const guidedItems = [];
  const fields = sectionDefinition?.flat_fields || [];

  fields.forEach((field, index) => {
    const value = valuesByFieldCode?.[field.field_code];
    if (!hasFilledValue(field, value)) return;
    const itemPayload = fieldValueToItemPayload(field, value, index);
    if (itemPayload) {
      guidedItems.push(itemPayload);
    }
  });

  const guidedCodes = new Set(guidedItems.map((item) => item.item_code));
  const safeLegacy = (Array.isArray(legacyItems) ? legacyItems : [])
    .filter((item) => {
      const code = String(item.item_code || "").trim();
      return code && !guidedCodes.has(code);
    })
    .map((item, index) => ({
      item_code: String(item.item_code || "").trim(),
      item_label: String(item.item_label || item.item_code || "").trim(),
      value_text: item.value_text ?? null,
      value_json: item.value_json ?? null,
      sort_order:
        Number.isFinite(Number(item.sort_order))
          ? Number(item.sort_order)
          : fields.length + index,
    }));

  return [...guidedItems, ...safeLegacy];
}
