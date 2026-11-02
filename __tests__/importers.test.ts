import { describe, it, expect } from "vitest";
import {
  importPostmanCollection,
  importCurl,
  importOpenApi,
  exportPostmanCollection,
} from "../src/lib/importers";

describe("Collection Import / Export Engine", () => {
  it("imports cURL command into structured request", () => {
    const curl = `curl -X POST https://api.example.com/v1/items \\
      -H "Authorization: Bearer token123" \\
      -H "Content-Type: application/json" \\
      -d '{"name": "Widget", "price": 42}'`;

    const imported = importCurl(curl);
    expect(imported.method).toBe("POST");
    expect(imported.url).toBe("https://api.example.com/v1/items");
    expect(imported.headers.length).toBe(2);
    expect(imported.headers.find((h) => h.key === "Content-Type")?.value).toBe(
      "application/json"
    );
    expect(imported.body_type).toBe("json");
    expect(JSON.parse(imported.body_content)).toEqual({
      name: "Widget",
      price: 42,
    });
  });

  it("imports Postman Collection v2.1 format", () => {
    const postman = {
      info: {
        name: "Test Postman Suite",
        description: "Suite description",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "Get Users",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "https://api.example.com/users",
              protocol: "https",
              host: ["api", "example", "com"],
              path: ["users"],
            },
          },
        },
      ],
    };

    const result = importPostmanCollection(postman);
    expect(result.name).toBe("Test Postman Suite");
    expect(result.requests.length).toBe(1);
    expect(result.requests[0].name).toBe("Get Users");
    expect(result.requests[0].method).toBe("GET");
    expect(result.requests[0].url).toBe("https://api.example.com/users");
  });

  it("imports basic OpenAPI 3.x spec", () => {
    const openapi = {
      openapi: "3.0.0",
      info: { title: "Pet Store", description: "Sample API" },
      servers: [{ url: "https://petstore.example.com/v1" }],
      paths: {
        "/pets": {
          get: { summary: "List pets", tags: ["Pets"] },
          post: { summary: "Create pet", tags: ["Pets"] },
        },
      },
    };

    const result = importOpenApi(openapi);
    expect(result.name).toBe("Pet Store");
    expect(result.folders).toContain("Pets");
    expect(result.requests.length).toBe(2);
  });

  it("exports to valid Postman v2.1 collection format", () => {
    const requests = [
      {
        name: "Create User",
        method: "POST",
        url: "https://api.example.com/users",
        headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
        params: [],
        body_type: "json",
        body_content: '{"name":"John"}',
        auth_type: "bearer",
        auth_config: { token: "secret" },
        folder_name: "Users",
      },
    ];

    const exported = exportPostmanCollection(
      "Exported Suite",
      "Suite desc",
      requests,
      ["Users"]
    ) as any;

    expect(exported.info.name).toBe("Exported Suite");
    expect(exported.item.length).toBe(1); // "Users" folder
    expect(exported.item[0].name).toBe("Users");
    expect(exported.item[0].item[0].name).toBe("Create User");
    expect(exported.item[0].item[0].request.method).toBe("POST");
  });
});

