export type ComparisonOperator =
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | 'like' | 'ilike' | 'between' | 'in';

export interface ComparisonNode {
  id: string;
  type: 'comparison';
  operator: ComparisonOperator;
  property: string;
  value: unknown;
}

export interface LogicalNode {
  id: string;
  type: 'logical';
  operator: 'and' | 'or';
  children: FilterNode[];
}

export interface NotNode {
  id: string;
  type: 'not';
  child: FilterNode;
}

export type FilterNode = ComparisonNode | LogicalNode | NotNode;

export type GeoStylerFilter = unknown[] | null;
