import { describe, it, expect } from "vitest";
import {
  resolveVariables,
  buildVarMap,
  resolveKVList,
  extractVariableNames,
} from "../src/lib/variables";

describe("Variable Substitution Engine", () => {
  it("resolves single and multiple {{variables}}", () => {
    const vars = {
      base_url: "https://api.example.com",
      version: "v2",
      user_id: "usr_123",
    };

    const text = "{{base_url}}/{{version}}/users/{{user_id}}";
    expect(resolveVariables(text, vars)).toBe(
      "https://api.example.com/v2/users/usr_123"
    );
  });

  it("leaves unknown variables unchanged", () => {
    const vars = { known: "yes" };
    const text = "known={{known}}&unknown={{missing}}";
    expect(resolveVariables(text, vars)).toBe("known=yes&unknown={{missing}}");
  });

  it("builds map from EnvVariable array", () => {
    const list = [
      { key: "k1", value: "v1", is_secret: false },
      { key: "k2", value: "v2", is_secret: true },
      { key: "", value: "ignore", is_secret: false },
    ];
    const map = buildVarMap(list);
    expect(map).toEqual({ k1: "v1", k2: "v2" });
  });

  it("resolves key-value list with enabled flags", () => {
    const list = [
      { key: "x-api-key", value: "{{api_key}}", enabled: true },
      { key: "x-env", value: "{{env}}", enabled: false },
    ];
    const vars = { api_key: "secret123", env: "staging" };
    const resolved = resolveKVList(list, vars);
    expect(resolved).toEqual([
      { key: "x-api-key", value: "secret123", enabled: true },
      { key: "x-env", value: "staging", enabled: false },
    ]);
  });

  it("extracts all variable names from template string", () => {
    const template = "{{host}}:{{port}}/api/{{path}}?token={{token}}&repeat={{host}}";
    const names = extractVariableNames(template);
    expect(names).toEqual(["host", "port", "path", "token"]);
  });
});

