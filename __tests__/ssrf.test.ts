import { describe, it, expect } from "vitest";
import { validateTargetUrl } from "../src/lib/ssrf";

describe("SSRF Protection Engine", () => {
  it("allows safe public http and https URLs", () => {
    expect(validateTargetUrl("https://api.github.com/users")).toBeNull();
    expect(validateTargetUrl("http://example.com/api/v1")).toBeNull();
    expect(validateTargetUrl("https://93.184.216.34/test")).toBeNull();
  });

  it("blocks forbidden protocols", () => {
    expect(validateTargetUrl("ftp://example.com/file")).toContain("Blocked scheme");
    expect(validateTargetUrl("file:///etc/passwd")).toContain("Blocked scheme");
    expect(validateTargetUrl("gopher://localhost:70")).toContain("Blocked scheme");
  });

  it("blocks localhost and loopback addresses", () => {
    expect(validateTargetUrl("http://localhost:3000")).toContain("Blocked");
    expect(validateTargetUrl("http://127.0.0.1:8080")).toContain("Blocked");
    expect(validateTargetUrl("http://0.0.0.0/")).toContain("Blocked");
    expect(validateTargetUrl("http://[::1]/")).toContain("Blocked");
  });

  it("blocks private network IPv4 ranges", () => {
    // 10.0.0.0/8
    expect(validateTargetUrl("http://10.0.1.5/admin")).toContain("Blocked private/reserved IP");
    // 172.16.0.0/12
    expect(validateTargetUrl("http://172.20.0.1/")).toContain("Blocked private/reserved IP");
    // 192.168.0.0/16
    expect(validateTargetUrl("http://192.168.1.1/router")).toContain("Blocked private/reserved IP");
  });

  it("blocks cloud metadata and link-local addresses", () => {
    // AWS / GCP / Azure metadata endpoint
    expect(validateTargetUrl("http://169.254.169.254/latest/meta-data/")).toContain("Blocked");
    expect(validateTargetUrl("http://metadata.google.internal/")).toContain("Blocked");
  });

  it("blocks URLs with embedded credentials", () => {
    expect(validateTargetUrl("http://admin:secret@example.com")).toContain("URLs with credentials");
  });

  it("blocks internal / local domain suffixes", () => {
    expect(validateTargetUrl("http://service.local/api")).toContain("Blocked");
    expect(validateTargetUrl("http://app.internal/status")).toContain("Blocked");
  });
});

