function readable(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[object Object]") return "";
  return trimmed;
}

/** Turn an API error body into a sentence. Nested `{ error: { message } }` must not become "[object Object]". */
export function describeApiError(body: unknown, fallback: string): string {
  const direct = readable(body);
  if (direct) return direct;
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  const errorText = readable(record.error);
  if (errorText) return errorText;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    const nestedText =
      readable(nested.message) || readable(nested.error) || readable(nested.err);
    if (nestedText) return nestedText;
  }
  return (
    readable(record.message) ||
    readable(record.err) ||
    readable(record.name) ||
    fallback
  );
}
