/**
 * {{variable}} resolver — substitutes placeholders with values from
 * the active environment.  No eval, no user-supplied JavaScript.
 */

export interface EnvVariable {
  key: string;
  value: string; // plaintext (decrypted for secrets at resolve-time)
  is_secret: boolean;
}

const VAR_RE = /\{\{(\w+)\}\}/g;

/**
 * Replace all `{{key}}` placeholders in `text` with their values.
 * Unknown variables are left as-is.
 */
export function resolveVariables(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(VAR_RE, (_match, key) =>
    key in vars ? vars[key] : `{{${key}}}`
  );
}

/**
 * Build a flat lookup map from an array of EnvVariable.
 */
export function buildVarMap(variables: EnvVariable[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of variables) {
    if (v.key) map[v.key] = v.value;
  }
  return map;
}

/**
 * Resolve variables in every string field of a key-value pair array.
 * Used for headers, params, etc.
 */
export function resolveKVList(
  list: { key: string; value: string; enabled?: boolean }[],
  vars: Record<string, string>
): { key: string; value: string; enabled?: boolean }[] {
  return list.map((item) => ({
    ...item,
    key: resolveVariables(item.key, vars),
    value: resolveVariables(item.value, vars),
  }));
}

/**
 * Extract variables referenced in a text.
 * Returns the set of variable names found.
 */
export function extractVariableNames(text: string): string[] {
  const names: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

