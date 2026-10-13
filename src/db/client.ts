import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export async function initDbWithPragma(d1: D1Database) {
  await d1.exec('PRAGMA foreign_keys = ON;');
  return drizzle(d1, { schema });
}

export { schema };
