const SENSITIVE_KEYS = new Set(['passwordHash']);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (value && typeof value === 'object') {
    if (value instanceof Date) {
      return value;
    }

    const sanitizedObject: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        continue;
      }
      sanitizedObject[key] = sanitize(nestedValue);
    }
    return sanitizedObject;
  }

  return value;
}

export function sanitizeResponsePayload<T>(payload: T): T {
  return sanitize(payload) as T;
}
