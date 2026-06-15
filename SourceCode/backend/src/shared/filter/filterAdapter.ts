import type { DataSchema } from '../types.js';
import type { FilterNode, ComparisonOperator, GeoStylerFilter } from './types.js';

let uidCounter = 0;
function uid(): string {
  return `filter-node-${++uidCounter}`;
}

export function toFilterNode(filter: GeoStylerFilter): FilterNode {
  if (!filter) {
    return { id: uid(), type: 'comparison', operator: '==', property: '', value: '' };
  }

  const [op, ...args] = filter;

  if (op === '&&' || op === '||') {
    return {
      id: uid(),
      type: 'logical',
      operator: op === '&&' ? 'and' : 'or',
      children: (args as GeoStylerFilter[]).map(toFilterNode),
    };
  }

  if (op === '!') {
    return {
      id: uid(),
      type: 'not',
      child: toFilterNode(args[0] as GeoStylerFilter),
    };
  }

  if (op === 'between') {
    const [property, min, max] = args as [string, number, number];
    return {
      id: uid(),
      type: 'comparison',
      operator: 'between',
      property,
      value: [min, max],
    };
  }

  if (op === 'in') {
    const [property, values] = args as [string, (string | number | boolean)[]];
    return {
      id: uid(),
      type: 'comparison',
      operator: 'in',
      property,
      value: values,
    };
  }

  const [property, value] = args as [string, string | number | boolean];
  return {
    id: uid(),
    type: 'comparison',
    operator: op as ComparisonOperator,
    property,
    value,
  };
}

export function toGeoStylerFilter(node: FilterNode): GeoStylerFilter {
  switch (node.type) {
    case 'comparison':
      if (node.operator === 'between') {
        const [min, max] = node.value as [number, number];
        return ['between', node.property, min, max];
      }
      if (node.operator === 'in') {
        return ['in', node.property, node.value as (string | number | boolean)[]];
      }
      return [node.operator, node.property, node.value as string | number | boolean];

    case 'logical': {
      const op = node.operator === 'and' ? '&&' : '||';
      return [op, ...node.children.map(toGeoStylerFilter)];
    }

    case 'not':
      return ['!', toGeoStylerFilter(node.child)];

    default:
      throw new Error('Unknown filter node type');
  }
}

export function validateComparison(node: { property: string; operator: ComparisonOperator; value: unknown }, schema?: DataSchema): string | null {
  if (!node.property) {
    return 'Property name is required';
  }

  const prop = schema?.properties.find((p) => p.name === node.property);
  if (!prop) {
    return null; // No schema, no validation.
  }

  if (node.operator === 'between') {
    if (!Array.isArray(node.value) || node.value.length !== 2) {
      return 'Between operator requires [min, max]';
    }
    const [min, max] = node.value as [number, number];
    if (typeof min !== 'number' || typeof max !== 'number') {
      return 'Between range values must be numbers';
    }
    if (prop.type !== 'number' && prop.type !== 'integer') {
      return `Between operator cannot be applied to ${prop.type} field`;
    }
    return null;
  }

  if (node.operator === 'in') {
    if (!Array.isArray(node.value)) {
      return 'In operator requires an array of values';
    }
    return null;
  }

  const val = node.value as string | number | boolean;
  if (val === undefined || val === null || val === '') {
    return 'Comparison value is required';
  }

  const valueType = typeof val;
  if (prop.type === 'number' || prop.type === 'integer') {
    if (valueType !== 'number') {
      return `Expected number for ${prop.name}, got ${valueType}`;
    }
  } else if (prop.type === 'boolean') {
    if (valueType !== 'boolean') {
      return `Expected boolean for ${prop.name}, got ${valueType}`;
    }
  } else if (prop.type === 'date') {
    if (valueType !== 'string' && valueType !== 'number') {
      return `Expected date string or timestamp for ${prop.name}`;
    }
  }

  return null;
}
