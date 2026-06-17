import {
  type SLDRoot,
  type NamedLayerNode,
  type UserStyleNode,
  type FeatureTypeStyleNode,
  type RuleNode,
  type SymbolizerNode,
  type NodeType,
  type SymbolizerKind,
  type NamedLayerNodeData,
  type UserStyleNodeData,
  type FeatureTypeStyleNodeData,
  type RuleNodeData,
  type SymbolizerNodeData,
  type ValidationIssue,
  TreePath,
  type GeoStylerStyle,
  type ScaleDenominatorRange,
  type FeatureTypeStyleMeta,
  type TreeStateSnapshot,
} from './types.js';
import { GeoStylerTransformer } from './transformer.js';
import { ValidationEngine } from './validation-engine.js';
import { XMLPostProcessor } from './xml-post-processor.js';
import SldParser from 'geostyler-sld-parser';

let _idCounter = 0;
function generateId(): string {
  return `node_${++_idCounter}_${Date.now().toString(36)}`;
}

function resetIdCounter(): void {
  _idCounter = 0;
}

function createDefaultNamedLayer(): NamedLayerNode {
  return {
    id: generateId(),
    type: 'NamedLayer',
    data: { name: 'default_layer' },
    children: [createDefaultUserStyle()],
  };
}

function createDefaultUserStyle(): UserStyleNode {
  return {
    id: generateId(),
    type: 'UserStyle',
    data: {
      name: 'default_style',
      title: '',
      abstract: '',
      isDefault: false,
    },
    children: [createDefaultFeatureTypeStyle()],
  };
}

function createDefaultFeatureTypeStyle(): FeatureTypeStyleNode {
  return {
    id: generateId(),
    type: 'FeatureTypeStyle',
    data: {
      title: '',
      abstract: '',
      featureTypeName: '',
    },
    children: [createDefaultRule()],
  };
}

function createDefaultRule(): RuleNode {
  return {
    id: generateId(),
    type: 'Rule',
    data: {
      name: 'default_rule',
      title: '',
      abstract: '',
      elseFilter: false,
      scaleDenominator: { min: null, max: null },
      filter: null,
    },
    children: [createDefaultSymbolizer('Mark')],
  };
}

function createDefaultSymbolizer(kind: SymbolizerKind): SymbolizerNode {
  const data: SymbolizerNodeData = {};
  switch (kind) {
    case 'Mark':
      data.markWellKnownName = 'circle';
      data.markRadius = 12;
      data.markFillColor = '#FF0000';
      data.markFillOpacity = 1;
      data.markStrokeColor = '#000000';
      data.markStrokeWidth = 0;
      data.markStrokeOpacity = 1;
      data.markRotate = 0;
      break;
    case 'Line':
      data.lineColor = '#FF0000';
      data.lineWidth = 4;
      data.lineOpacity = 1;
      data.lineDasharray = 'solid';
      data.lineCap = 'round';
      data.lineJoin = 'round';
      break;
    case 'Fill':
      data.fillColor = '#CCFFCC';
      data.fillOpacity = 1;
      data.fillOutlineColor = '#333333';
      data.fillOutlineWidth = 1;
      data.fillOutlineOpacity = 1;
      data.fillOutlineDasharray = [];
      break;
    case 'Text':
      data.textLabel = 'name';
      data.textFont = 'Arial';
      data.textSize = 12;
      data.textColor = '#000000';
      data.textFontWeight = 'normal';
      data.textFontStyle = 'normal';
      data.textAnchor = { x: 0.5, y: 0.5 };
      data.textOffset = { x: 0, y: 0 };
      data.textHaloColor = '#FFFFFF';
      data.textHaloWidth = 0;
      break;
  }
  return {
    id: generateId(),
    type: 'Symbolizer',
    kind,
    data,
    children: [],
  };
}

function deepCloneNode<T extends NamedLayerNode | UserStyleNode | FeatureTypeStyleNode | RuleNode | SymbolizerNode>(node: T): T {
  const cloned = { ...node, children: node.children.map((c) => deepCloneNode(c as any)) } as T;
  return cloned;
}

function getNodeAtPath(root: SLDRoot, path: TreePath): NamedLayerNode | UserStyleNode | FeatureTypeStyleNode | RuleNode | SymbolizerNode | null {
  const segments = path.toArray();
  if (segments.length === 0) return null;
  if (segments[0] !== 0) return null;

  let current: BaseNode = root.namedLayer;
  for (let i = 1; i < segments.length; i++) {
    const idx = segments[i];
    if (idx < 0 || idx >= current.children.length) return null;
    current = current.children[idx];
  }
  return current as NamedLayerNode | UserStyleNode | FeatureTypeStyleNode | RuleNode | SymbolizerNode;
}

function getParentNode(root: SLDRoot, path: TreePath): BaseNode | null {
  const parentPath = path.parent();
  if (!parentPath) return null;
  return getNodeAtPath(root, parentPath) as BaseNode | null;
}

function setNodeAtPath(root: SLDRoot, path: TreePath, newNode: BaseNode): SLDRoot {
  const segments = path.toArray();
  if (segments.length === 0) {
    if (newNode.type !== 'NamedLayer') throw new Error('Root node must be NamedLayer');
    return { ...root, namedLayer: newNode as NamedLayerNode };
  }
  if (segments[0] !== 0) throw new Error('Invalid path: root segment must be 0');

  const newRoot = deepCloneNode(root.namedLayer);
  if (segments.length === 1) {
    return { ...root, namedLayer: newNode as NamedLayerNode };
  }

  let current: BaseNode = newRoot;
  const stack: BaseNode[] = [current];

  for (let i = 1; i < segments.length - 1; i++) {
    const idx = segments[i];
    current = current.children[idx];
    stack.push(current);
  }

  const lastIdx = segments[segments.length - 1];
  const parent = stack[stack.length - 1];
  const newChildren = [...parent.children];
  newChildren[lastIdx] = newNode;
  parent.children = newChildren;

  return { ...root, namedLayer: newRoot as NamedLayerNode };
}

function removeChildAt(root: SLDRoot, path: TreePath): SLDRoot {
  const segments = path.toArray();
  if (segments.length === 0) {
    throw new Error('Cannot remove root node');
  }
  if (segments[0] !== 0) throw new Error('Invalid path: root segment must be 0');
  if (segments.length === 1) {
    throw new Error('Cannot remove root NamedLayer');
  }

  const newRoot = deepCloneNode(root.namedLayer);
  let current: BaseNode = newRoot;
  const stack: BaseNode[] = [current];

  for (let i = 1; i < segments.length - 1; i++) {
    const idx = segments[i];
    current = current.children[idx];
    stack.push(current);
  }

  const lastIdx = segments[segments.length - 1];
  const parent = stack[stack.length - 1];
  const newChildren = [...parent.children];
  newChildren.splice(lastIdx, 1);
  parent.children = newChildren;

  return { ...root, namedLayer: newRoot as NamedLayerNode };
}

function insertChildAt(root: SLDRoot, parentPath: TreePath, node: BaseNode, index?: number): SLDRoot {
  const segments = parentPath.toArray();
  if (segments.length === 0 || segments[0] !== 0) {
    throw new Error('Invalid parent path');
  }

  const newRoot = deepCloneNode(root.namedLayer);
  let current: BaseNode = newRoot;

  for (let i = 1; i < segments.length; i++) {
    const idx = segments[i];
    current = current.children[idx];
  }

  const newChildren = [...current.children];
  const insertIndex = index !== undefined ? index : newChildren.length;
  newChildren.splice(insertIndex, 0, node);
  current.children = newChildren;

  return { ...root, namedLayer: newRoot as NamedLayerNode };
}

function moveChild(root: SLDRoot, sourcePath: TreePath, targetPath: TreePath): SLDRoot {
  const sourceSegments = sourcePath.toArray();
  const targetSegments = targetPath.toArray();

  if (sourceSegments.length !== targetSegments.length) {
    throw new Error('Move only supported within the same level');
  }

  const sourceParent = sourcePath.parent();
  const targetParent = targetPath.parent();
  if (!sourceParent || !targetParent || !sourceParent.equals(targetParent)) {
    throw new Error('Move only supported within the same parent');
  }

  const node = getNodeAtPath(root, sourcePath);
  if (!node) throw new Error('Source node not found');

  let tree = removeChildAt(root, sourcePath);
  const sourceIndex = sourceSegments[sourceSegments.length - 1];
  const targetIndex = targetSegments[targetSegments.length - 1];

  const adjustedIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
  tree = insertChildAt(tree, sourceParent, deepCloneNode(node as any), adjustedIndex);

  return tree;
}

interface BaseNode {
  id: string;
  type: NodeType;
  children: BaseNode[];
}

export class SLDTree {
  readonly root: SLDRoot;

  constructor(root?: SLDRoot) {
    if (root) {
      this.root = root;
    } else {
      resetIdCounter();
      this.root = {
        version: '1.0.0',
        namedLayer: createDefaultNamedLayer(),
      };
    }
  }

  addNode(parentPath: TreePath, type: NodeType, kind?: SymbolizerKind): SLDTree {
    if (type === 'NamedLayer') {
      throw new Error('NamedLayer can only exist at root level');
    }

    const parent = getNodeAtPath(this.root, parentPath);
    if (!parent) throw new Error('Parent node not found');

    let newNode: BaseNode;

    switch (type) {
      case 'UserStyle': {
        if (parent.type !== 'NamedLayer') throw new Error('UserStyle must be child of NamedLayer');
        if (parent.children.length >= 1) {
          throw new Error('MVP only supports one UserStyle per NamedLayer');
        }
        newNode = createDefaultUserStyle();
        break;
      }
      case 'FeatureTypeStyle': {
        if (parent.type !== 'UserStyle') throw new Error('FeatureTypeStyle must be child of UserStyle');
        newNode = createDefaultFeatureTypeStyle();
        break;
      }
      case 'Rule': {
        if (parent.type !== 'FeatureTypeStyle') throw new Error('Rule must be child of FeatureTypeStyle');
        newNode = createDefaultRule();
        break;
      }
      case 'Symbolizer': {
        if (parent.type !== 'Rule') throw new Error('Symbolizer must be child of Rule');
        const symbolizerKind = kind || 'Mark';
        newNode = createDefaultSymbolizer(symbolizerKind);
        break;
      }
      default:
        throw new Error(`Unknown node type: ${type}`);
    }

    const newRoot = insertChildAt(this.root, parentPath, newNode);
    return new SLDTree(newRoot);
  }

  removeNode(path: TreePath): SLDTree {
    const node = getNodeAtPath(this.root, path);
    if (!node) throw new Error('Node not found');
    if (node.type === 'NamedLayer') throw new Error('Cannot remove root NamedLayer');

    const parent = getParentNode(this.root, path);
    if (!parent) throw new Error('Parent not found');

    if (node.type === 'UserStyle' && parent.children.length <= 1) {
      throw new Error('Cannot remove the last UserStyle');
    }
    if (node.type === 'FeatureTypeStyle' && parent.children.length <= 1) {
      throw new Error('Cannot remove the last FeatureTypeStyle');
    }
    if (node.type === 'Rule' && parent.children.length <= 1) {
      throw new Error('Cannot remove the last Rule');
    }
    if (node.type === 'Symbolizer' && parent.children.length <= 1) {
      throw new Error('Cannot remove the last Symbolizer');
    }

    const newRoot = removeChildAt(this.root, path);
    return new SLDTree(newRoot);
  }

  updateNode(path: TreePath, patch: Partial<Record<string, unknown>>): SLDTree {
    const node = getNodeAtPath(this.root, path);
    if (!node) throw new Error('Node not found');

    const newNode = { ...node, data: { ...node.data, ...patch } } as unknown as BaseNode;
    const newRoot = setNodeAtPath(this.root, path, newNode);
    return new SLDTree(newRoot);
  }

  moveNode(sourcePath: TreePath, targetPath: TreePath): SLDTree {
    const newRoot = moveChild(this.root, sourcePath, targetPath);
    return new SLDTree(newRoot);
  }

  toGeoStyler(): GeoStylerStyle {
    return GeoStylerTransformer.toGeoStyler(this.root);
  }

  async toSLDXML(): Promise<string> {
    const parser = new SldParser();
    const geoStyler = this.toGeoStyler();
    const { output: sldXml } = await parser.writeStyle(geoStyler);
    return XMLPostProcessor.assembleFullSLD(this.root, sldXml as string);
  }

  static fromGeoStyler(style: GeoStylerStyle, featureTypeStyleMeta?: FeatureTypeStyleMeta[]): SLDTree {
    const root = GeoStylerTransformer.fromGeoStyler(style, featureTypeStyleMeta);
    return new SLDTree(root);
  }

  static async fromSLDXML(xml: string): Promise<SLDTree> {
    const parser = new SldParser();
    const { output: style, warnings } = await parser.readStyle(xml);

    const meta = XMLPostProcessor.extractMetaFromSLD(xml);
    const tree = SLDTree.fromGeoStyler(style as GeoStylerStyle, meta);

    if (warnings && warnings.length > 0) {
      // warnings are logged but not blocking
    }

    return tree;
  }

  validate(): ValidationIssue[] {
    return new ValidationEngine().validate(this.root);
  }

  toSnapshot(
    selectedPath?: TreePath | null,
    expandedPaths?: string[],
    issues?: ValidationIssue[]
  ): TreeStateSnapshot {
    return {
      version: this.root.version,
      root: this.root,
      selectedPath: selectedPath?.toArray() ?? null,
      expandedPaths: expandedPaths ?? [],
      issues: issues ?? [],
    };
  }

  getNodeAt(path: TreePath): NamedLayerNode | UserStyleNode | FeatureTypeStyleNode | RuleNode | SymbolizerNode | null {
    return getNodeAtPath(this.root, path);
  }
}

