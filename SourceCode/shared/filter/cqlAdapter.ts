import type { GeoStylerFilter } from './types.js';

export function toCql(filter: GeoStylerFilter | null): string {
  if (!filter) return '';
  const [op, ...args] = filter as [string, ...unknown[]];

  switch (op) {
    case '==':
      return `${property(args[0])} = ${literal(args[1])}`;
    case '!=':
      return `${property(args[0])} <> ${literal(args[1])}`;
    case '>':
      return `${property(args[0])} > ${literal(args[1])}`;
    case '>=':
      return `${property(args[0])} >= ${literal(args[1])}`;
    case '<':
      return `${property(args[0])} < ${literal(args[1])}`;
    case '<=':
      return `${property(args[0])} <= ${literal(args[1])}`;
    case 'like':
      return `${property(args[0])} LIKE ${literal(args[1])}`;
    case 'ilike':
      return `${property(args[0])} ILIKE ${literal(args[1])}`;
    case 'between': {
      const [prop, min, max] = args as [string, number, number];
      return `${property(prop)} BETWEEN ${literal(min)} AND ${literal(max)}`;
    }
    case 'in': {
      const [prop, values] = args as [string, (string | number | boolean)[]];
      return `${property(prop)} IN (${values.map(literal).join(', ')})`;
    }
    case '&&':
      return `(${args.map((f) => toCql(f as GeoStylerFilter)).join(' AND ')})`;
    case '||':
      return `(${args.map((f) => toCql(f as GeoStylerFilter)).join(' OR ')})`;
    case '!':
      return `NOT (${toCql(args[0] as GeoStylerFilter)})`;
    default:
      return '';
  }
}

function property(name: unknown): string {
  return String(name);
}

function literal(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
