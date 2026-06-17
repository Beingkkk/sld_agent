import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface EditorTypeDefinition {
  component: string;
  valueType: string;
  defaultProps: Record<string, unknown>;
}

export interface FieldDefinition {
  id: string;
  label: string;
  description: string;
  editor: string;
  required: boolean;
  default: unknown;
  options?: string[] | Array<{ label: string; value: string; dasharray?: number[] }>;
  editorProps?: Record<string, unknown>;
  geoStylerPath?: string;
  sldElement?: string;
  sldCssParameter?: string;
}

export interface NodeSchema {
  nodeType: string;
  label: string;
  fields: string[];
  groups?: Array<{ id: string; label: string; fields: string[] }>;
}

export interface SymbolizerSchema {
  kind: string;
  userLabel: string;
  description: string;
  groups: Array<{ id: string; label: string; fields: string[] }>;
}

export interface Domain {
  id: string;
  name: string;
  description: string;
  default?: boolean;
}

export interface SLDReference {
  version: string;
  description: string;
  root: Record<string, unknown>;
  elements: Record<string, Record<string, unknown>>;
}

export interface Example {
  userPrompt: string;
  explanation: string;
  treeOperations: Record<string, unknown>[];
}

export interface KnowledgeBaseData {
  // Registry
  editorTypes: Record<string, EditorTypeDefinition>;
  fields: Record<string, FieldDefinition>;
  nodeSchemas: Record<string, NodeSchema>;
  symbolizerSchemas: Record<string, SymbolizerSchema>;

  // Knowledge
  domains: Domain[];
  generalConstraints: string[];
  modificationRules: string[];
  sldReference: SLDReference;
  examples: Example[];
}

export class KnowledgeBase {
  private data: KnowledgeBaseData | null = null;
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async load(): Promise<void> {
    const registryPath = resolve(this.basePath, 'registry');
    const knowledgePath = resolve(this.basePath, 'knowledge');

    const editorTypesRaw = JSON.parse(readFileSync(resolve(registryPath, 'editor-types.json'), 'utf-8')) as { editors: Record<string, EditorTypeDefinition> };
    const fieldRegistryRaw = JSON.parse(readFileSync(resolve(registryPath, 'field-registry.json'), 'utf-8')) as { fields: Record<string, FieldDefinition> };
    const nodeSchemasRaw = JSON.parse(readFileSync(resolve(registryPath, 'node-schemas.json'), 'utf-8')) as { nodes: Record<string, NodeSchema> };
    const symbolizerSchemasRaw = JSON.parse(readFileSync(resolve(registryPath, 'symbolizer-schemas.json'), 'utf-8')) as { symbolizers: Record<string, SymbolizerSchema> };

    const rootKnowledge = JSON.parse(readFileSync(resolve(knowledgePath, 'root.json'), 'utf-8')) as { domains: Domain[] };
    const defaultKnowledge = JSON.parse(readFileSync(resolve(knowledgePath, 'default.json'), 'utf-8')) as {
      version: string;
      constraints: string[];
      modificationRules: string[];
    };
    const sldReferenceRaw = JSON.parse(readFileSync(resolve(knowledgePath, 'sld-reference.json'), 'utf-8')) as SLDReference;
    const examplesRaw = JSON.parse(readFileSync(resolve(knowledgePath, 'examples.json'), 'utf-8')) as { examples: Example[] };

    this.data = {
      editorTypes: editorTypesRaw.editors,
      fields: fieldRegistryRaw.fields,
      nodeSchemas: nodeSchemasRaw.nodes,
      symbolizerSchemas: symbolizerSchemasRaw.symbolizers,
      domains: rootKnowledge.domains,
      generalConstraints: defaultKnowledge.constraints,
      modificationRules: defaultKnowledge.modificationRules,
      sldReference: sldReferenceRaw,
      examples: examplesRaw.examples,
    };
  }

  getEditorType(type: string): EditorTypeDefinition | undefined {
    return this.data?.editorTypes[type];
  }

  getField(id: string): FieldDefinition | undefined {
    return this.data?.fields[id];
  }

  getNodeSchema(nodeType: string): NodeSchema | undefined {
    return this.data?.nodeSchemas[nodeType];
  }

  getSymbolizerSchema(kind: string): SymbolizerSchema | undefined {
    return this.data?.symbolizerSchemas[kind];
  }

  getDomainCatalog(): Domain[] {
    return this.data?.domains ?? [];
  }

  getGeneralConstraints(): string[] {
    return this.data?.generalConstraints ?? [];
  }

  getModificationRules(): string[] {
    return this.data?.modificationRules ?? [];
  }

  getSLDReference(): SLDReference | null {
    return this.data?.sldReference ?? null;
  }

  getExamples(): Example[] {
    return this.data?.examples ?? [];
  }

  buildFieldDictionaryPrompt(): string {
    if (!this.data) return '';

    const lines: string[] = ['# 字段词典\n'];
    for (const [id, field] of Object.entries(this.data.fields)) {
      lines.push(`- ${id}: ${field.label} (${field.description}) [类型: ${field.editor}]`);
    }
    return lines.join('\n');
  }

  buildSLDReferencePrompt(): string {
    const ref = this.data?.sldReference;
    if (!ref) return '';

    const lines: string[] = ['# SLD 元素速查\n'];
    for (const [element, info] of Object.entries(ref.elements)) {
      const desc = info.description ?? '';
      const children = info.children ? `子元素: ${(info.children as string[]).join(', ')}` : '';
      lines.push(`- ${element}: ${desc} ${children}`.trim());
    }
    return lines.join('\n');
  }

  buildExamplesPrompt(): string {
    const examples = this.data?.examples ?? [];
    if (examples.length === 0) return '';

    const lines: string[] = ['# Few-shot 样例\n'];
    for (const ex of examples) {
      lines.push(`用户: "${ex.userPrompt}"`);
      lines.push(`解释: ${ex.explanation}`);
      lines.push(`操作: ${JSON.stringify(ex.treeOperations)}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  buildConstraintsPrompt(): string {
    const constraints = this.data?.generalConstraints ?? [];
    if (constraints.length === 0) return '';

    return '# 通用约束\n' + constraints.map((c) => `- ${c}`).join('\n');
  }
}
