import { ColumnDefinition, VALID_TYPES, ColumnType } from './schemas';

const IDENTIFIER_REGEX = /^[a-z][a-z0-9_]{0,40}$/;

export class ValidationError extends Error {
  statusCode: number;
  details?: Record<string, string>;

  constructor(message: string, statusCode = 400, details?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validates identifier names (table, schema, project, column, version).
 * Must start with a lowercase letter, followed by lowercase letters, numbers, or underscores, max 41 chars.
 */
export function validateIdentifier(name: string, label = 'Identifier'): string {
  if (typeof name !== 'string') {
    throw new ValidationError(`${label} must be a string`, 400);
  }
  const trimmed = name.trim();
  if (!IDENTIFIER_REGEX.test(trimmed)) {
    throw new ValidationError(
      `${label} "${trimmed}" is invalid. Must start with a lowercase letter and contain only lowercase alphanumeric characters or underscores (max 41 chars).`,
      400
    );
  }
  return trimmed;
}

export function validateVersion(version: string): string {
  if (typeof version !== 'string') {
    throw new ValidationError('Version must be a string', 400);
  }
  const trimmed = version.trim().toLowerCase();
  if (!/^v[0-9]+([a-z0-9_]*)$/.test(trimmed)) {
    throw new ValidationError(
      `Version "${trimmed}" is invalid. Must start with 'v' followed by numbers (e.g., v1, v2, v1_beta).`,
      400
    );
  }
  return trimmed;
}

/**
 * Validates the column array provided during API or Project creation.
 */
export function validateColumns(columns: any): ColumnDefinition[] {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new ValidationError('At least one column definition is required.', 400);
  }

  const seen = new Set<string>();
  const reserved = new Set(['id', 'created_at', 'updated_at']);

  const sanitized: ColumnDefinition[] = [];

  for (const col of columns) {
    if (!col || typeof col !== 'object') {
      throw new ValidationError('Each column must be an object definition.', 400);
    }

    const name = validateIdentifier(col.name, 'Column name');
    if (reserved.has(name)) {
      throw new ValidationError(
        `Column name "${name}" is reserved by the system (id, created_at, updated_at).`,
        400
      );
    }

    if (seen.has(name)) {
      throw new ValidationError(`Duplicate column name "${name}".`, 400);
    }
    seen.add(name);

    if (!VALID_TYPES.includes(col.type)) {
      throw new ValidationError(
        `Invalid type "${col.type}" for column "${name}". Allowed types: ${VALID_TYPES.join(', ')}.`,
        400
      );
    }

    sanitized.push({
      name,
      type: col.type as ColumnType,
      required: Boolean(col.required),
      default: col.default ?? null,
      unique: Boolean(col.unique),
    });
  }

  return sanitized;
}

/**
 * Validates a request body object against column definitions for CRUD operations.
 * If isPartial is true (PATCH), missing required fields are allowed.
 */
export function validateBody(
  body: any,
  columns: ColumnDefinition[],
  isPartial = false
): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object.', 400);
  }

  const result: Record<string, any> = {};
  const errors: Record<string, string> = {};

  const colMap = new Map(columns.map((c) => [c.name, c]));

  // Check for unexpected extra keys
  for (const key of Object.keys(body)) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') {
      continue; // Ignored or handled separately
    }
    if (!colMap.has(key)) {
      errors[key] = `Unknown field "${key}".`;
    }
  }

  for (const col of columns) {
    const val = body[col.name];

    if (val === undefined) {
      const hasDefault = col.default !== null && col.default !== undefined;
      if (!isPartial && col.required && !hasDefault) {
        errors[col.name] = `Field "${col.name}" is required.`;
      } else if (!isPartial && hasDefault) {
        result[col.name] = col.default;
      }
      continue;
    }

    if (val === null) {
      if (col.required) {
        errors[col.name] = `Field "${col.name}" cannot be null.`;
      } else {
        result[col.name] = null;
      }
      continue;
    }

    // Type coercion & validation
    switch (col.type) {
      case 'text':
        if (typeof val !== 'string') {
          errors[col.name] = `Field "${col.name}" must be a string.`;
        } else {
          result[col.name] = val;
        }
        break;

      case 'int':
        if (typeof val === 'number' && Number.isInteger(val)) {
          result[col.name] = val;
        } else if (typeof val === 'string' && /^-?\d+$/.test(val)) {
          const parsed = parseInt(val, 10);
          result[col.name] = parsed;
        } else {
          errors[col.name] = `Field "${col.name}" must be an integer.`;
        }
        break;

      case 'bigint':
        if (typeof val === 'number' && Number.isInteger(val)) {
          result[col.name] = BigInt(val).toString();
        } else if (typeof val === 'string' && /^-?\d+$/.test(val)) {
          result[col.name] = val;
        } else {
          errors[col.name] = `Field "${col.name}" must be a valid bigint number or string.`;
        }
        break;

      case 'float':
        if (typeof val === 'number' && !Number.isNaN(val)) {
          result[col.name] = val;
        } else if (typeof val === 'string' && !Number.isNaN(parseFloat(val))) {
          result[col.name] = parseFloat(val);
        } else {
          errors[col.name] = `Field "${col.name}" must be a number/float.`;
        }
        break;

      case 'bool':
        if (typeof val === 'boolean') {
          result[col.name] = val;
        } else if (val === 'true' || val === 1) {
          result[col.name] = true;
        } else if (val === 'false' || val === 0) {
          result[col.name] = false;
        } else {
          errors[col.name] = `Field "${col.name}" must be a boolean.`;
        }
        break;

      case 'json':
        try {
          result[col.name] = typeof val === 'string' ? JSON.parse(val) : val;
        } catch {
          errors[col.name] = `Field "${col.name}" must be valid JSON.`;
        }
        break;

      case 'timestamp': {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          errors[col.name] = `Field "${col.name}" must be a valid ISO timestamp or date string.`;
        } else {
          result[col.name] = d.toISOString();
        }
        break;
      }

      case 'uuid':
        if (
          typeof val === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
        ) {
          result[col.name] = val.toLowerCase();
        } else {
          errors[col.name] = `Field "${col.name}" must be a valid UUID string.`;
        }
        break;

      default:
        result[col.name] = val;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed for one or more fields.', 422, errors);
  }

  return result;
}
