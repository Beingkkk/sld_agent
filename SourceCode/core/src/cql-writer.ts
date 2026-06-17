import type { FilterNode } from './types.js';

function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}

function formatValue(value: string | number | undefined): string {
  if (value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${escapeString(value)}'`;
}

export class CqlWriter {
  /** FilterNode → CQL 文本（只读预览） */
  static write(node: FilterNode): string {
    return CqlWriter.writeNode(node);
  }

  private static writeNode(node: FilterNode): string {
    switch (node.type) {
      case 'and':
      case 'or': {
        const children = node.children || [];
        if (children.length === 0) return '';
        const joiner = node.type === 'and' ? ' AND ' : ' OR ';
        const parts = children.map((child) => {
          const childCql = CqlWriter.writeNode(child);
          // 子节点为比较节点时不需要额外括号
          if (child.type === 'comparison') return childCql;
          return `(${childCql})`;
        });
        return parts.join(joiner);
      }
      case 'not': {
        const children = node.children || [];
        if (children.length === 0) return '';
        const childCql = CqlWriter.writeNode(children[0]);
        if (children[0].type === 'comparison') {
          return `NOT ${childCql}`;
        }
        return `NOT (${childCql})`;
      }
      case 'comparison': {
        const op = node.operator;
        const propertyName = node.propertyName ?? '';
        const value = node.value;

        switch (op) {
          case '==':
            return `${propertyName} = ${formatValue(value)}`;
          case '!=':
            return `${propertyName} <> ${formatValue(value)}`;
          case '<':
            return `${propertyName} < ${formatValue(value)}`;
          case '<=':
            return `${propertyName} <= ${formatValue(value)}`;
          case '>':
            return `${propertyName} > ${formatValue(value)}`;
          case '>=':
            return `${propertyName} >= ${formatValue(value)}`;
          case '*=':
            return `${propertyName} LIKE ${formatValue(value)}`;
          default:
            return `${propertyName} ${op ?? '?'} ${formatValue(value)}`;
        }
      }
      default:
        return '';
    }
  }
}
