import type { Filter as GeoStylerFilter } from 'geostyler-style';
import type { FilterNode, FilterComparisonOperator, FilterNodeType } from './types.js';

let _idCounter = 0;
function generateId(): string {
  return `filter_${++_idCounter}_${Date.now().toString(36)}`;
}

/** FilterNode 工厂函数 */
export function createFilterNode(
  type: FilterNodeType,
  partial: Omit<Partial<FilterNode>, 'type' | 'id'> = {}
): FilterNode {
  return {
    id: generateId(),
    type,
    ...partial,
  };
}

const LOGIC_OPERATORS: Record<Exclude<FilterNodeType, 'comparison'>, string> = {
  and: '&&',
  or: '||',
  not: '!',
};

const COMPARISON_OPERATORS: Record<FilterComparisonOperator, string> = {
  '==': '==',
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  '*=': '*=',
};

const REVERSE_COMPARISON: Record<string, FilterComparisonOperator> = {
  '==': '==',
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  '*=': '*=',
};

export class FilterTransformer {
  /** FilterNode → GeoStyler Filter */
  static toGeoStyler(node: FilterNode): GeoStylerFilter {
    switch (node.type) {
      case 'and':
      case 'or': {
        const op = LOGIC_OPERATORS[node.type];
        const children = (node.children || []).map((child) => FilterTransformer.toGeoStyler(child));
        if (children.length === 0) {
          throw new Error(`FilterNode of type '${node.type}' must have at least one child`);
        }
        return [op, ...children] as GeoStylerFilter;
      }
      case 'not': {
        const children = node.children || [];
        if (children.length !== 1) {
          throw new Error("FilterNode of type 'not' must have exactly one child");
        }
        return ['!', FilterTransformer.toGeoStyler(children[0])] as GeoStylerFilter;
      }
      case 'comparison': {
        const op = node.operator;
        if (!op || !COMPARISON_OPERATORS[op]) {
          throw new Error(`Unsupported comparison operator: ${op}`);
        }
        if (node.propertyName === undefined) {
          throw new Error("Comparison filter node must have propertyName");
        }
        if (node.value === undefined) {
          throw new Error("Comparison filter node must have value");
        }
        return [COMPARISON_OPERATORS[op], node.propertyName, node.value] as GeoStylerFilter;
      }
      default:
        throw new Error(`Unsupported filter node type: ${(node as FilterNode).type}`);
    }
  }

  /** GeoStyler Filter → FilterNode */
  static fromGeoStyler(filter: GeoStylerFilter): FilterNode {
    if (!Array.isArray(filter) || filter.length === 0) {
      throw new Error('Invalid GeoStyler filter');
    }

    const op = filter[0] as string;

    if (op === '&&' || op === '||') {
      const children = filter.slice(1).map((child) => FilterTransformer.fromGeoStyler(child as GeoStylerFilter));
      return createFilterNode(op === '&&' ? 'and' : 'or', { children });
    }

    if (op === '!') {
      if (filter.length !== 2) {
        throw new Error("GeoStyler '!' filter must have exactly one operand");
      }
      const child = FilterTransformer.fromGeoStyler(filter[1] as GeoStylerFilter);
      return createFilterNode('not', { children: [child] });
    }

    if (REVERSE_COMPARISON[op]) {
      if (filter.length !== 3) {
        throw new Error(`GeoStyler '${op}' filter must have exactly two operands`);
      }
      return createFilterNode('comparison', {
        operator: REVERSE_COMPARISON[op],
        propertyName: String(filter[1]),
        value: filter[2] as string | number,
      });
    }

    // MVP：不支持的函数表达式标记为 unsupported 比较节点
    return createFilterNode('comparison', {
      operator: '==',
      propertyName: '__unsupported__',
      value: JSON.stringify(filter),
    });
  }

  /** 创建默认根 FilterNode（单一比较条件） */
  static createDefaultComparison(
    propertyName = 'name',
    operator: FilterComparisonOperator = '==',
    value: string | number = ''
  ): FilterNode {
    return createFilterNode('comparison', { propertyName, operator, value });
  }
}
