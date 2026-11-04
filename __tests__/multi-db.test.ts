import { describe, it, expect } from 'vitest';
import { detectDatabaseType, testMultiDbConnection } from '../src/lib/multi-db';

describe('Multi-Database Support Engine', () => {
  it('correctly detects database types from URLs', () => {
    expect(detectDatabaseType('mongodb://localhost:27017/mydb')).toBe('mongodb');
    expect(detectDatabaseType('mongodb+srv://user:pass@cluster.mongodb.net/test')).toBe('mongodb');
    expect(detectDatabaseType('mysql://root:secret@127.0.0.1:3306/app')).toBe('mysql');
    expect(detectDatabaseType('mysql2://user:pass@host/db')).toBe('mysql');
    expect(detectDatabaseType('sqlite:./data.db')).toBe('sqlite');
    expect(detectDatabaseType('app.sqlite')).toBe('sqlite');
    expect(detectDatabaseType('postgresql://user:pass@host/neondb')).toBe('postgres');
    expect(detectDatabaseType('postgres://user:pass@host/neondb')).toBe('postgres');
  });

  it('validates protocol requirements per database type', async () => {
    const invalidPg = await testMultiDbConnection('ftp://some-host', 'postgres');
    expect(invalidPg.success).toBe(false);
    expect(invalidPg.error).toContain('PostgreSQL URL must start with');

    const invalidMysql = await testMultiDbConnection('http://mysql-host', 'mysql');
    expect(invalidMysql.success).toBe(false);
    expect(invalidMysql.error).toContain('MySQL URL must start with mysql://');

    const invalidMongo = await testMultiDbConnection('redis://mongo-host', 'mongodb');
    expect(invalidMongo.success).toBe(false);
    expect(invalidMongo.error).toContain('MongoDB URL must start with mongodb://');
  });

  it('rejects empty database URLs', async () => {
    const res = await testMultiDbConnection('', 'postgres');
    expect(res.success).toBe(false);
    expect(res.error).toContain('URL is required');
  });
});

