import { describe, it, expect } from "vitest";
import {
  runAssertions,
  resolveJsonPath,
  extractVariables,
  Assertion,
  ResponseData,
} from "../src/lib/assertions";

describe("Assertion Engine", () => {
  const sampleResponse: ResponseData = {
    status: 200,
    timeMs: 140,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": "req_123456",
    },
    body: JSON.stringify({
      code: 200,
      data: {
        total: 2,
        users: [
          { id: "u_1", name: "Alice", role: "admin", active: true },
          { id: "u_2", name: "Bob", role: "member", active: false },
        ],
      },
    }),
    parsedJson: {
      code: 200,
      data: {
        total: 2,
        users: [
          { id: "u_1", name: "Alice", role: "admin", active: true },
          { id: "u_2", name: "Bob", role: "member", active: false },
        ],
      },
    },
  };

  it("evaluates status assertions", () => {
    const assertions: Assertion[] = [
      { type: "status", operator: "eq", expected: 200 },
      { type: "status", operator: "neq", expected: 404 },
      { type: "status", operator: "lt", expected: 300 },
      { type: "status", operator: "gte", expected: 200 },
    ];
    const results = runAssertions(assertions, sampleResponse);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("evaluates latency assertions", () => {
    const assertions: Assertion[] = [
      { type: "latency", operator: "lt", expected: 500 },
      { type: "latency", operator: "gt", expected: 50 },
    ];
    const results = runAssertions(assertions, sampleResponse);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("evaluates header assertions", () => {
    const assertions: Assertion[] = [
      { type: "header", target: "content-type", operator: "contains", expected: "application/json" },
      { type: "header", target: "x-request-id", operator: "exists" },
      { type: "header", target: "x-non-existent", operator: "not_exists" },
    ];
    const results = runAssertions(assertions, sampleResponse);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("evaluates JSON path assertions", () => {
    const assertions: Assertion[] = [
      { type: "json_path", target: "code", operator: "eq", expected: 200 },
      { type: "json_path", target: "data.total", operator: "eq", expected: 2 },
      { type: "json_path", target: "data.users[0].name", operator: "eq", expected: "Alice" },
      { type: "json_path", target: "data.users[1].role", operator: "eq", expected: "member" },
      { type: "json_path", target: "data.users[0].active", operator: "eq", expected: "true" },
    ];
    const results = runAssertions(assertions, sampleResponse);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("evaluates body_contains assertions", () => {
    const assertions: Assertion[] = [
      { type: "body_contains", operator: "contains", expected: "Alice" },
      { type: "body_contains", operator: "not_contains", expected: "Charlie" },
    ];
    const results = runAssertions(assertions, sampleResponse);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("handles failed assertions with descriptive message", () => {
    const assertions: Assertion[] = [
      { type: "status", operator: "eq", expected: 404 },
    ];
    const results = runAssertions(assertions, sampleResponse);
    expect(results[0].passed).toBe(false);
    expect(results[0].actual).toBe(200);
  });
});

describe("resolveJsonPath helper", () => {
  const data = {
    user: {
      profile: {
        emails: ["one@mail.com", "two@mail.com"],
        meta: { age: 30 },
      },
    },
  };

  it("resolves nested objects and arrays", () => {
    expect(resolveJsonPath(data, "user.profile.meta.age")).toBe(30);
    expect(resolveJsonPath(data, "user.profile.emails[1]")).toBe("two@mail.com");
    expect(resolveJsonPath(data, "user.profile.emails.0")).toBe("one@mail.com");
  });

  it("returns undefined for missing paths", () => {
    expect(resolveJsonPath(data, "user.profile.nonexistent")).toBeUndefined();
    expect(resolveJsonPath(data, "user.profile.emails[9]")).toBeUndefined();
  });
});

describe("extractVariables helper", () => {
  it("extracts values into dictionary", () => {
    const json = {
      orderId: "ord_999",
      customer: { id: "cust_777" },
    };
    const rules = [
      { json_path: "orderId", variable_name: "order_id" },
      { json_path: "customer.id", variable_name: "customer_id" },
    ];
    const extracted = extractVariables(json, rules);
    expect(extracted).toEqual({
      order_id: "ord_999",
      customer_id: "cust_777",
    });
  });
});

