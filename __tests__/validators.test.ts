import { describe, it, expect } from 'vitest';
import {
  validateIdentifier,
  validateVersion,
  validateColumns,
  validateBody,
  ValidationError,
} from '../src/lib/validators';
import { ColumnDefinition } from '../src/lib/schemas';

describe('Validators', () => {
  describe('validateIdentifier', () => {
    it('accepts valid snake_case identifiers starting with letter', () => {
      expect(validateIdentifier('users')).toBe('users');
      expect(validateIdentifier('shop_app')).toBe('shop_app');
      expect(validateIdentifier('api_v1_orders')).toBe('api_v1_orders');
    });

    it('rejects identifiers starting with numbers or symbols', () => {
      expect(() => validateIdentifier('123users')).toThrow(ValidationError);
      expect(() => validateIdentifier('_hidden')).toThrow(ValidationError);
      expect(() => validateIdentifier('-invalid')).toThrow(ValidationError);
    });

    it('rejects uppercase characters or spaces', () => {
      expect(() => validateIdentifier('Users')).toThrow(ValidationError);
      expect(() => validateIdentifier('shop app')).toThrow(ValidationError);
      expect(() => validateIdentifier('shop-app')).toThrow(ValidationError);
    });

    it('rejects identifiers longer than 41 characters', () => {
      const longName = 'a' + 'b'.repeat(45);
      expect(() => validateIdentifier(longName)).toThrow(ValidationError);
    });
  });

  describe('validateVersion', () => {
    it('accepts valid versions', () => {
      expect(validateVersion('v1')).toBe('v1');
      expect(validateVersion('v2')).toBe('v2');
      expect(validateVersion('v1_beta')).toBe('v1_beta');
    });

    it('rejects versions not starting with v and number', () => {
      expect(() => validateVersion('1.0')).toThrow(ValidationError);
      expect(() => validateVersion('beta')).toThrow(ValidationError);
    });
  });

  describe('validateColumns', () => {
    it('accepts valid column definitions', () => {
      const input = [
        { name: 'title', type: 'text', required: true },
        { name: 'price', type: 'float', required: false, default: 0 },
        { name: 'is_active', type: 'bool' },
      ];
      const result = validateColumns(input);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('title');
      expect(result[0].type).toBe('text');
      expect(result[0].required).toBe(true);
    });

    it('rejects reserved system column names', () => {
      expect(() => validateColumns([{ name: 'id', type: 'uuid' }])).toThrow(ValidationError);
      expect(() => validateColumns([{ name: 'created_at', type: 'timestamp' }])).toThrow(ValidationError);
      expect(() => validateColumns([{ name: 'updated_at', type: 'timestamp' }])).toThrow(ValidationError);
    });

    it('rejects duplicate column names', () => {
      expect(() =>
        validateColumns([
          { name: 'price', type: 'float' },
          { name: 'price', type: 'int' },
        ])
      ).toThrow(ValidationError);
    });

    it('rejects invalid or unsupported types', () => {
      expect(() =>
        validateColumns([{ name: 'data', type: 'unsupported_type' }])
      ).toThrow(ValidationError);
    });
  });

  describe('validateBody', () => {
    const columns: ColumnDefinition[] = [
      { name: 'name', type: 'text', required: true },
      { name: 'age', type: 'int', required: false, default: 18 },
      { name: 'score', type: 'float', required: false },
      { name: 'verified', type: 'bool', required: false },
      { name: 'meta', type: 'json', required: false },
    ];

    it('validates and coerces correct values', () => {
      const body = {
        name: 'Alice',
        age: '25',
        score: '99.5',
        verified: 'true',
        meta: { role: 'admin' },
      };

      const result = validateBody(body, columns, false);
      expect(result.name).toBe('Alice');
      expect(result.age).toBe(25);
      expect(result.score).toBe(99.5);
      expect(result.verified).toBe(true);
      expect(result.meta).toEqual({ role: 'admin' });
    });

    it('applies default when optional field is missing', () => {
      const body = { name: 'Bob' };
      const result = validateBody(body, columns, false);
      expect(result.name).toBe('Bob');
      expect(result.age).toBe(18);
    });

    it('throws when required field is missing in full mode', () => {
      const body = { age: 30 };
      expect(() => validateBody(body, columns, false)).toThrow(ValidationError);
    });

    it('allows missing required field in partial mode (PATCH)', () => {
      const body = { age: 30 };
      const result = validateBody(body, columns, true);
      expect(result.age).toBe(30);
      expect(result.name).toBeUndefined();
    });

    it('throws on unknown fields', () => {
      const body = { name: 'Charlie', unknown_field: 'bad' };
      expect(() => validateBody(body, columns, false)).toThrow(ValidationError);
    });
  });
});

