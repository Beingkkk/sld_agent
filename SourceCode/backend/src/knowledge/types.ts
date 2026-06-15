export interface DomainInfo {
  id: string;
  name: string;
  description: string;
  default: boolean;
}

export interface StyleCatalogItem {
  style_type: string;
  geometry_types: string[];
  description: string;
}

export interface ParameterDef {
  name: string;
  type: string;
  description: string;
  default?: unknown;
}

export interface FewShotExample {
  instruction: string;
  params: unknown;
}

export interface KnowledgeBase {
  domains: DomainInfo[];
  activeDomain: string;
  styleCatalog: StyleCatalogItem[];
  parameterDictionary: Record<string, ParameterDef>;
  constraints: string[];
  fewShotExamples: FewShotExample[];
  modificationRules: string[];
}

export interface PromptContext {
  knowledgeBase: KnowledgeBase;
  currentParams?: unknown;
  instruction: string;
  geometryType?: string;
  styleType?: string;
  preserve?: string[];
  dataSchema?: unknown;
}
