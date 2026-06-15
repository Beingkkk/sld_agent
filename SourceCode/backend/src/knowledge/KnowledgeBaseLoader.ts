import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { KnowledgeBase, DomainInfo, StyleCatalogItem, ParameterDef, FewShotExample } from './types.js';

export class KnowledgeBaseLoader {
  async load(rootDir: string, activeDomain = 'default'): Promise<KnowledgeBase> {
    const rootPath = resolve(rootDir, 'root.json');
    const root = JSON.parse(readFileSync(rootPath, 'utf-8')) as {
      domains: DomainInfo[];
    };

    const defaultData = this.loadDomain(rootDir, 'default');
    const activeData = activeDomain === 'default' ? {} : this.loadDomain(rootDir, activeDomain);

    return {
      domains: root.domains,
      activeDomain,
      styleCatalog: this.mergeArray(defaultData.styleCatalog, activeData.styleCatalog),
      parameterDictionary: { ...defaultData.parameterDictionary, ...activeData.parameterDictionary },
      constraints: this.mergeArray(defaultData.constraints, activeData.constraints),
      fewShotExamples: this.mergeArray(defaultData.fewShotExamples, activeData.fewShotExamples),
      modificationRules: this.mergeArray(defaultData.modificationRules, activeData.modificationRules),
    };
  }

  private loadDomain(rootDir: string, domain: string): {
    styleCatalog?: StyleCatalogItem[];
    parameterDictionary?: Record<string, ParameterDef>;
    constraints?: string[];
    fewShotExamples?: FewShotExample[];
    modificationRules?: string[];
  } {
    const path = resolve(rootDir, `${domain}.json`);
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as {
        styleCatalog?: StyleCatalogItem[];
        parameterDictionary?: Record<string, ParameterDef>;
        constraints?: string[];
        fewShotExamples?: FewShotExample[];
        modificationRules?: string[];
      };
    } catch {
      return {};
    }
  }

  private mergeArray<T>(base: T[] = [], override: T[] = []): T[] {
    return [...override, ...base];
  }
}
