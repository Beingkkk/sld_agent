import type {
  Style,
  Symbolizer,
  MarkSymbolizer,
  LineSymbolizer,
  FillSymbolizer,
  TextSymbolizer,
  ScaleDenominator,
  Filter,
} from 'geostyler-style';

export type GeoStylerStyle = Style;
export type GeoStylerSymbolizer = Symbolizer;
export type {
  MarkSymbolizer,
  LineSymbolizer,
  FillSymbolizer,
  TextSymbolizer,
  ScaleDenominator,
  Filter,
};

export type NodeType = 'NamedLayer' | 'UserStyle' | 'FeatureTypeStyle' | 'Rule' | 'Symbolizer';

export type SymbolizerKind = 'Mark' | 'Line' | 'Fill' | 'Text';

/** Filter 节点树运算符 */
export type FilterComparisonOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' | '*=';

/** Filter 节点类型 */
export type FilterNodeType = 'and' | 'or' | 'not' | 'comparison';

/** Filter 节点树 */
export interface FilterNode {
  /** 节点唯一标识 */
  id: string;
  /** 节点类型 */
  type: FilterNodeType;
  /** 比较运算符，仅 comparison 节点有效 */
  operator?: FilterComparisonOperator;
  /** 属性名，仅 comparison 节点有效 */
  propertyName?: string;
  /** 比较值，仅 comparison 节点有效 */
  value?: string | number;
  /** 子节点，and/or/not 节点有效 */
  children?: FilterNode[];
}

export interface ScaleDenominatorRange {
  min: number | null;
  max: number | null;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface NamedLayerNodeData {
  name: string;
}

export interface UserStyleNodeData {
  name: string;
  title: string;
  abstract: string;
  isDefault: boolean;
}

export interface FeatureTypeStyleNodeData {
  title: string;
  abstract: string;
  featureTypeName: string;
}

export interface RuleNodeData {
  name: string;
  title: string;
  abstract: string;
  elseFilter: boolean;
  scaleDenominator: ScaleDenominatorRange;
  filter: FilterNode | null;
}

export type SymbolizerNodeData = Record<string, unknown>;

export interface BaseNode {
  id: string;
  type: NodeType;
  children: BaseNode[];
}

export interface NamedLayerNode extends BaseNode {
  type: 'NamedLayer';
  data: NamedLayerNodeData;
  children: [UserStyleNode];
}

export interface UserStyleNode extends BaseNode {
  type: 'UserStyle';
  data: UserStyleNodeData;
  children: FeatureTypeStyleNode[];
}

export interface FeatureTypeStyleNode extends BaseNode {
  type: 'FeatureTypeStyle';
  data: FeatureTypeStyleNodeData;
  children: RuleNode[];
}

export interface RuleNode extends BaseNode {
  type: 'Rule';
  data: RuleNodeData;
  children: SymbolizerNode[];
}

export interface SymbolizerNode extends BaseNode {
  type: 'Symbolizer';
  kind: SymbolizerKind;
  data: SymbolizerNodeData;
  children: [];
}

export interface SLDRoot {
  version: string;
  namedLayer: NamedLayerNode;
}

export interface ValidationIssue {
  path: TreePath;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TreeStateSnapshot {
  version: string;
  root: SLDRoot;
  selectedPath: number[] | null;
  expandedPaths: string[];
  issues: ValidationIssue[];
}

export interface TransformResult {
  geoStyler: GeoStylerStyle;
  sldXml: string;
  issues: ValidationIssue[];
}

export interface FeatureTypeStyleMeta {
  title: string;
  abstract: string;
  featureTypeName: string;
}

export class TreePath {
  readonly segments: readonly number[];

  constructor(segments: number[]) {
    this.segments = Object.freeze([...segments]);
  }

  child(index: number): TreePath {
    return new TreePath([...this.segments, index]);
  }

  parent(): TreePath | null {
    if (this.segments.length === 0) return null;
    return new TreePath(this.segments.slice(0, -1));
  }

  equals(other: TreePath): boolean {
    if (this.segments.length !== other.segments.length) return false;
    return this.segments.every((s, i) => s === other.segments[i]);
  }

  toString(): string {
    return JSON.stringify(this.segments);
  }

  static fromString(str: string): TreePath {
    return new TreePath(JSON.parse(str));
  }

  toArray(): number[] {
    return [...this.segments];
  }
}
