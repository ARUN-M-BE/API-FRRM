export type ColumnType =
  | 'text'
  | 'int'
  | 'bigint'
  | 'bool'
  | 'float'
  | 'json'
  | 'timestamp'
  | 'uuid';

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  required?: boolean;
  default?: string | number | boolean | null;
  unique?: boolean;
}

export const VALID_TYPES: readonly ColumnType[] = [
  'text',
  'int',
  'bigint',
  'bool',
  'float',
  'json',
  'timestamp',
  'uuid',
] as const;

export function mapColumnTypeToPostgres(type: ColumnType): string {
  switch (type) {
    case 'text':
      return 'TEXT';
    case 'int':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'bool':
      return 'BOOLEAN';
    case 'float':
      return 'DOUBLE PRECISION';
    case 'json':
      return 'JSONB';
    case 'timestamp':
      return 'TIMESTAMPTZ';
    case 'uuid':
      return 'UUID';
    default:
      throw new Error(`Unsupported column type: ${type}`);
  }
}

