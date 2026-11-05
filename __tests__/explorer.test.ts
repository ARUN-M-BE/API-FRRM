import { describe, it, expect } from 'vitest';
import { buildSampleBodyFromColumns, generateCurlCommand } from '../src/lib/discovery';
import { importCurl } from '../src/lib/importers';

describe('API Explorer & cURL Generator', () => {
  it('buildSampleBodyFromColumns generates typed dummy payload', () => {
    const columns = [
      { name: 'id', type: 'uuid' },
      { name: 'title', type: 'text' },
      { name: 'price', type: 'float' },
      { name: 'stock_qty', type: 'int' },
      { name: 'is_active', type: 'bool' },
      { name: 'metadata', type: 'json' },
      { name: 'contact_email', type: 'text' },
      { name: 'created_at', type: 'timestamp' },
    ];

    const body = buildSampleBodyFromColumns(columns);

    // id and created_at should be skipped
    expect(body.id).toBeUndefined();
    expect(body.created_at).toBeUndefined();

    // Type inference checks
    expect(body.title).toBe('Sample Text');
    expect(body.price).toBe(29.99);
    expect(body.stock_qty).toBe(42);
    expect(body.is_active).toBe(true);
    expect(body.metadata).toEqual({ key: 'value' });
    expect(body.contact_email).toBe('user@example.com');
  });

  it('generateCurlCommand generates valid GET cURL command with query params', () => {
    const curl = generateCurlCommand(
      {
        method: 'GET',
        endpoint: '/api/p/store/v1/products',
        headers: [{ key: 'Accept', value: 'application/json' }],
        params: [
          { key: 'limit', value: '20', type: 'int' },
          { key: 'sort', value: 'desc', type: 'string' },
        ],
        bodySchema: null,
        auth: { type: 'api-key', headerKey: 'x-api-key', description: '' },
        project_api_key: 'frrm_live_secret123456789',
      },
      'https://myapi.workers.dev',
      false
    );

    expect(curl).toContain("curl --location 'https://myapi.workers.dev/api/p/store/v1/products?limit=20&sort=desc'");
    expect(curl).toContain("--header 'Accept: application/json'");
    expect(curl).toContain("--header 'x-api-key: frrm_live_secret123456789'");
    expect(curl).not.toContain('--request GET');
  });

  it('generateCurlCommand generates valid POST cURL command with body and secret masking', () => {
    const curlMasked = generateCurlCommand(
      {
        method: 'POST',
        endpoint: '/api/p/store/v1/products',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer sk_super_secret_token_123' },
        ],
        params: [],
        bodySchema: { title: 'New Product', price: 99.5 },
        auth: { type: 'bearer', description: '' },
      },
      'https://api.frrm.dev',
      true
    );

    expect(curlMasked).toContain("curl --location 'https://api.frrm.dev/api/p/store/v1/products'");
    expect(curlMasked).toContain('--request POST');
    expect(curlMasked).toContain('--header \'Content-Type: application/json\'');
    // Secret should be masked
    expect(curlMasked).toContain('••••••••');
    expect(curlMasked).not.toContain('sk_super_secret_token_123');
    expect(curlMasked).toContain('"title": "New Product"');
    expect(curlMasked).toContain('"price": 99.5');
  });

  it('roundtrips cURL command through importCurl', () => {
    const originalPayload = { name: 'Super Widget', in_stock: true };
    const curl = generateCurlCommand(
      {
        method: 'POST',
        endpoint: 'https://example.com/api/v1/widgets',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        params: [],
        bodySchema: originalPayload,
        auth: { type: 'none', description: '' },
      },
      'https://example.com',
      false
    );

    const parsed = importCurl(curl);
    expect(parsed.method).toBe('POST');
    expect(parsed.url).toBe('https://example.com/api/v1/widgets');
    expect(parsed.headers.some((h) => h.key === 'Content-Type' && h.value === 'application/json')).toBe(true);
    expect(JSON.parse(parsed.body_content)).toEqual(originalPayload);
  });
});
