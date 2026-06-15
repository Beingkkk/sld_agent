import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PromptContext, KnowledgeBase } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class PromptBuilder {
  private schemaJson: string;

  constructor(schemaPath?: string) {
    const path = schemaPath || resolve(__dirname, '../style/validation/style-params.schema.json');
    this.schemaJson = readFileSync(path, 'utf-8');
  }

  buildGeneratePrompt(ctx: PromptContext): string {
    return this.buildPrompt(ctx, 'generate');
  }

  buildModifyPrompt(ctx: PromptContext): string {
    return this.buildPrompt(ctx, 'modify');
  }

  private buildPrompt(ctx: PromptContext, mode: 'generate' | 'modify'): string {
    const parts: string[] = [];
    parts.push(this.systemPrompt(mode));
    parts.push(this.jsonSchemaPrompt());
    parts.push(this.knowledgePrompt(ctx.knowledgeBase));
    if (ctx.currentParams) {
      parts.push(`Current StyleParams:\n${JSON.stringify(ctx.currentParams, null, 2)}`);
    }
    if (ctx.preserve?.length) {
      parts.push(`Preserve these fields unchanged: ${ctx.preserve.join(', ')}`);
    }
    if (ctx.dataSchema) {
      parts.push(`Data schema:\n${JSON.stringify(ctx.dataSchema, null, 2)}`);
    }
    parts.push(`User instruction: ${ctx.instruction}`);
    return parts.join('\n\n');
  }

  private systemPrompt(mode: 'generate' | 'modify'): string {
    return `You are an expert GIS styling assistant. ${
      mode === 'generate' ? 'Generate' : 'Modify'
    } a StyleParams JSON object based on the user instruction. Output only valid JSON conforming to the schema below.`;
  }

  private jsonSchemaPrompt(): string {
    return `JSON Schema:\n${this.schemaJson}`;
  }

  private knowledgePrompt(kb: KnowledgeBase): string {
    const parts: string[] = [];
    if (kb.styleCatalog.length) {
      parts.push(`Style catalog:\n${JSON.stringify(kb.styleCatalog, null, 2)}`);
    }
    if (Object.keys(kb.parameterDictionary).length) {
      parts.push(`Parameter dictionary:\n${JSON.stringify(kb.parameterDictionary, null, 2)}`);
    }
    if (kb.constraints.length) {
      parts.push(`Constraints:\n${kb.constraints.join('\n')}`);
    }
    if (kb.fewShotExamples.length) {
      parts.push(`Examples:\n${JSON.stringify(kb.fewShotExamples, null, 2)}`);
    }
    if (kb.modificationRules.length) {
      parts.push(`Modification rules:\n${kb.modificationRules.join('\n')}`);
    }
    return parts.join('\n\n');
  }
}
