import { executeRawSql, sql } from './db';
import { ColumnDefinition, mapColumnTypeToPostgres } from './schemas';
import { validateIdentifier, validateVersion } from './validators';

export function getTableName(apiName: string, version: string): string {
  const cleanApi = validateIdentifier(apiName, 'API name');
  const cleanVer = validateVersion(version);
  return `${cleanApi}_${cleanVer}`;
}

export async function createProjectSchema(projectName: string): Promise<void> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  await executeRawSql(`CREATE SCHEMA IF NOT EXISTS "${cleanProject}"`);
}

export async function dropProjectSchema(projectName: string): Promise<void> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  await executeRawSql(`DROP SCHEMA IF EXISTS "${cleanProject}" CASCADE`);
}

export async function createApiTable(
  projectName: string,
  apiName: string,
  version: string,
  columns: ColumnDefinition[]
): Promise<string> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  const tableName = getTableName(apiName, version);

  const colDefinitions: string[] = [
    'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
  ];

  for (const col of columns) {
    const colName = validateIdentifier(col.name, 'Column name');
    const pgType = mapColumnTypeToPostgres(col.type);
    let def = `"${colName}" ${pgType}`;

    if (col.required) {
      def += ' NOT NULL';
    }

    if (col.unique) {
      def += ' UNIQUE';
    }

    if (col.default !== null && col.default !== undefined) {
      if (typeof col.default === 'string') {
        def += ` DEFAULT '${col.default.replace(/'/g, "''")}'`;
      } else if (typeof col.default === 'number' || typeof col.default === 'boolean') {
        def += ` DEFAULT ${col.default}`;
      }
    }

    colDefinitions.push(def);
  }

  const query = `
    CREATE TABLE IF NOT EXISTS "${cleanProject}"."${tableName}" (
      ${colDefinitions.join(',\n      ')}
    );
  `;

  await executeRawSql(query);
  return tableName;
}

export async function dropApiTable(
  projectName: string,
  apiName: string,
  version: string
): Promise<void> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  const tableName = getTableName(apiName, version);
  await executeRawSql(`DROP TABLE IF EXISTS "${cleanProject}"."${tableName}" CASCADE`);
}

