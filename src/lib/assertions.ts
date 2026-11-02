/**
 * Declarative assertion engine — no eval, no user-supplied JS.
 *
 * Assertion types:
 *   status   – compare HTTP status code
 *   latency  – compare response time in ms
 *   header   – compare a response header value
 *   json_path – compare a value at a JSON-path expression
 *   body_contains – check if body contains a substring
 *
 * Operators:
 *   eq, neq, lt, gt, lte, gte, contains, not_contains, exists, not_exists
 */

export interface Assertion {
  type: "status" | "latency" | "header" | "json_path" | "body_contains";
  target?: string; // header name or JSON path
  operator:
    | "eq"
    | "neq"
    | "lt"
    | "gt"
    | "lte"
    | "gte"
    | "contains"
    | "not_contains"
    | "exists"
    | "not_exists";
  expected?: string | number;
}

export interface AssertionResult {
  type: string;
  target?: string;
  operator: string;
  expected?: string | number;
  actual?: unknown;
  passed: boolean;
  message: string;
}

export interface ResponseData {
  status: number;
  timeMs: number;
  headers: Record<string, string>;
  body: string;
  parsedJson?: unknown;
}

/**
 * Run all assertions against a response. Returns per-assertion results.
 */
export function runAssertions(
  assertions: Assertion[],
  response: ResponseData
): AssertionResult[] {
  return assertions.map((a) => evaluateAssertion(a, response));
}

function evaluateAssertion(
  assertion: Assertion,
  res: ResponseData
): AssertionResult {
  const base = {
    type: assertion.type,
    target: assertion.target,
    operator: assertion.operator,
    expected: assertion.expected,
  };

  try {
    switch (assertion.type) {
      case "status":
        return compareNumeric(base, res.status, assertion);

      case "latency":
        return compareNumeric(base, res.timeMs, assertion);

      case "header": {
        const headerName = (assertion.target || "").toLowerCase();
        const headerVal = res.headers[headerName];
        if (
          assertion.operator === "exists" ||
          assertion.operator === "not_exists"
        ) {
          const exists = headerVal !== undefined;
          return {
            ...base,
            actual: exists ? headerVal : undefined,
            passed:
              assertion.operator === "exists" ? exists : !exists,
            message:
              assertion.operator === "exists"
                ? exists
                  ? `Header "${assertion.target}" exists`
                  : `Header "${assertion.target}" does not exist`
                : exists
                  ? `Header "${assertion.target}" exists (expected not to)`
                  : `Header "${assertion.target}" does not exist`,
          };
        }
        return compareString(base, headerVal ?? "", assertion);
      }

      case "json_path": {
        const path = assertion.target || "";
        const value = resolveJsonPath(res.parsedJson, path);
        if (
          assertion.operator === "exists" ||
          assertion.operator === "not_exists"
        ) {
          const exists = value !== undefined;
          return {
            ...base,
            actual: value,
            passed:
              assertion.operator === "exists" ? exists : !exists,
            message:
              assertion.operator === "exists"
                ? exists
                  ? `Path "${path}" exists`
                  : `Path "${path}" not found`
                : exists
                  ? `Path "${path}" exists (expected not to)`
                  : `Path "${path}" not found`,
          };
        }
        return compareAny(base, value, assertion);
      }

      case "body_contains": {
        const needle = String(assertion.expected ?? "");
        const found = res.body.includes(needle);
        if (assertion.operator === "not_contains") {
          return {
            ...base,
            actual: found ? `found "${needle}"` : "not found",
            passed: !found,
            message: found
              ? `Body contains "${needle}" (expected not to)`
              : `Body does not contain "${needle}"`,
          };
        }
        return {
          ...base,
          actual: found ? `found "${needle}"` : "not found",
          passed: found,
          message: found
            ? `Body contains "${needle}"`
            : `Body does not contain "${needle}"`,
        };
      }

      default:
        return {
          ...base,
          actual: undefined,
          passed: false,
          message: `Unknown assertion type: ${assertion.type}`,
        };
    }
  } catch (err) {
    return {
      ...base,
      actual: undefined,
      passed: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ------------------------------------------------------------------
// Comparison helpers
// ------------------------------------------------------------------

function compareNumeric(
  base: Omit<AssertionResult, "actual" | "passed" | "message">,
  actual: number,
  a: Assertion
): AssertionResult {
  const expected = Number(a.expected);
  let passed = false;
  switch (a.operator) {
    case "eq":
      passed = actual === expected;
      break;
    case "neq":
      passed = actual !== expected;
      break;
    case "lt":
      passed = actual < expected;
      break;
    case "gt":
      passed = actual > expected;
      break;
    case "lte":
      passed = actual <= expected;
      break;
    case "gte":
      passed = actual >= expected;
      break;
    default:
      return { ...base, actual, passed: false, message: `Invalid operator "${a.operator}" for numeric comparison` };
  }
  return {
    ...base,
    actual,
    passed,
    message: passed
      ? `${actual} ${a.operator} ${expected}`
      : `Expected ${actual} ${a.operator} ${expected}`,
  };
}

function compareString(
  base: Omit<AssertionResult, "actual" | "passed" | "message">,
  actual: string,
  a: Assertion
): AssertionResult {
  const expected = String(a.expected ?? "");
  let passed = false;
  switch (a.operator) {
    case "eq":
      passed = actual === expected;
      break;
    case "neq":
      passed = actual !== expected;
      break;
    case "contains":
      passed = actual.includes(expected);
      break;
    case "not_contains":
      passed = !actual.includes(expected);
      break;
    default:
      return { ...base, actual, passed: false, message: `Invalid operator "${a.operator}" for string comparison` };
  }
  return {
    ...base,
    actual,
    passed,
    message: passed
      ? `"${truncate(actual)}" ${a.operator} "${truncate(expected)}"`
      : `Expected "${truncate(actual)}" ${a.operator} "${truncate(expected)}"`,
  };
}

function compareAny(
  base: Omit<AssertionResult, "actual" | "passed" | "message">,
  actual: unknown,
  a: Assertion
): AssertionResult {
  const expected = a.expected;
  let passed = false;
  const actualStr = typeof actual === "object" ? JSON.stringify(actual) : String(actual ?? "");
  const expectedStr = String(expected ?? "");

  switch (a.operator) {
    case "eq":
      passed = actualStr === expectedStr || actual === expected;
      break;
    case "neq":
      passed = actualStr !== expectedStr && actual !== expected;
      break;
    case "contains":
      passed = actualStr.includes(expectedStr);
      break;
    case "not_contains":
      passed = !actualStr.includes(expectedStr);
      break;
    case "lt":
      passed = Number(actual) < Number(expected);
      break;
    case "gt":
      passed = Number(actual) > Number(expected);
      break;
    case "lte":
      passed = Number(actual) <= Number(expected);
      break;
    case "gte":
      passed = Number(actual) >= Number(expected);
      break;
    default:
      return { ...base, actual, passed: false, message: `Invalid operator "${a.operator}"` };
  }
  return {
    ...base,
    actual,
    passed,
    message: passed
      ? `${truncate(actualStr)} ${a.operator} ${truncate(expectedStr)}`
      : `Expected ${truncate(actualStr)} ${a.operator} ${truncate(expectedStr)}`,
  };
}

// ------------------------------------------------------------------
// Simple JSON-path resolver  (supports dot notation and bracket indices)
// e.g. "data.users[0].name" or "data.count"
// ------------------------------------------------------------------

export function resolveJsonPath(obj: unknown, path: string): unknown {
  if (!path || obj === undefined || obj === null) return undefined;

  // Normalise: data[0].name → data.0.name
  const normalised = path
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\./, "");

  const segments = normalised.split(".");
  let current: unknown = obj;

  for (const seg of segments) {
    if (current === undefined || current === null) return undefined;
    if (typeof current !== "object") return undefined;

    if (Array.isArray(current)) {
      const idx = parseInt(seg, 10);
      if (isNaN(idx)) return undefined;
      current = current[idx];
    } else {
      current = (current as Record<string, unknown>)[seg];
    }
  }

  return current;
}

/**
 * Extract JSON-path values from a parsed response and return variable
 * assignments. Used for "extract into variable" rules.
 */
export interface ExtractRule {
  json_path: string;
  variable_name: string;
}

export function extractVariables(
  parsedJson: unknown,
  rules: ExtractRule[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of rules) {
    const value = resolveJsonPath(parsedJson, rule.json_path);
    if (value !== undefined) {
      result[rule.variable_name] =
        typeof value === "object" ? JSON.stringify(value) : String(value);
    }
  }
  return result;
}

function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

