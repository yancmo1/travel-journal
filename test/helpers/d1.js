import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, '../..');

function rowsAsPlainObjects(rows) {
  return rows.map(row => Object.fromEntries(Object.entries(row)));
}

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.sql, values);
  }

  statement() {
    return this.database.prepare(this.sql);
  }

  isRowQuery() {
    return /^\s*(SELECT|PRAGMA|WITH)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql);
  }

  async first(columnName) {
    const row = this.statement().get(...this.values);
    if (row == null) return null;
    const plain = Object.fromEntries(Object.entries(row));
    return columnName ? plain[columnName] : plain;
  }

  async all() {
    return { results: rowsAsPlainObjects(this.statement().all(...this.values)) };
  }

  async run() {
    const result = this.statement().run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(result.changes || 0),
        last_row_id: Number(result.lastInsertRowid || 0),
      },
    };
  }

  execute() {
    if (this.isRowQuery()) {
      const results = rowsAsPlainObjects(this.statement().all(...this.values));
      return { results, meta: { changes: 0, last_row_id: 0 } };
    }
    const result = this.statement().run(...this.values);
    return {
      results: [],
      meta: {
        changes: Number(result.changes || 0),
        last_row_id: Number(result.lastInsertRowid || 0),
      },
    };
  }
}

export function createD1Database({ migrations = true } = {}) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  if (migrations) {
    const migrationFiles = readdirSync(path.join(projectRoot, 'drizzle'))
      .filter(file => file.endsWith('.sql'))
      .sort();
    for (const file of migrationFiles) {
      const sql = readFileSync(path.join(projectRoot, 'drizzle', file), 'utf8');
      for (const statement of sql.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) {
        database.exec(statement);
      }
    }
  }

  return {
    prepare(sql) {
      return new D1Statement(database, sql);
    },
    async batch(statements) {
      database.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.execute());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      database.close();
    },
  };
}
