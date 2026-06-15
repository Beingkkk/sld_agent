import type { Style } from 'geostyler-style';
import type {
  ApplyPatchRequest,
  ChatMessage,
  DataSchema,
  DomainsResult,
  ExportRequest,
  ExportResult,
  GenerateRequest,
  GenerationResult,
  ImportStyleRequest,
  ModifyRequest,
  Style as SharedStyle,
  StyleParams,
  ValidationReport,
} from '../shared/types.js';
import { SldAgentError } from '../errors.js';
import type { IAgentSession, AgentSessionOptions, SessionState } from './types.js';
import { PromptBuilder } from '../knowledge/PromptBuilder.js';
import { StyleParamsValidator } from '../style/validation/StyleParamsValidator.js';
import { ParamsNormalizer } from '../style/normalization/ParamsNormalizer.js';
import { StyleBuilderFactory, DefaultValueResolver, RuleGenerator } from '../style/builder/StyleBuilder.js';
import type { KnowledgeBase } from '../knowledge/types.js';

interface SldServiceLike {
  writeStyle(style: Style): Promise<string>;
  validate(style: Style, xml?: string): Promise<ValidationReport>;
}

interface LlmClientLike {
  complete(prompt: string): Promise<string>;
}

export class AgentSession implements IAgentSession {
  private id: string;
  private knowledgeBase: KnowledgeBase;
  private promptBuilder: PromptBuilder;
  private sldService: SldServiceLike;
  private llmClient: LlmClientLike;
  private validator = new StyleParamsValidator();
  private normalizer = new ParamsNormalizer();
  private resolver: DefaultValueResolver;
  private ruleGenerator = new RuleGenerator();
  private dataSchema?: DataSchema;
  private currentStyle?: Style;
  private lastValidStyle?: Style;
  private lastValidSldXml?: string;
  private params?: StyleParams;
  private chatHistory: ChatMessage[] = [];
  private busy = false;

  constructor(options: AgentSessionOptions) {
    this.id = options.id;
    this.knowledgeBase = options.knowledgeBase as KnowledgeBase;
    this.promptBuilder = options.promptBuilder;
    this.sldService = options.sldService as SldServiceLike;
    this.llmClient = options.llmClient as LlmClientLike;
    this.resolver = new DefaultValueResolver(this.knowledgeBase);
  }

  async generate(request: GenerateRequest): Promise<GenerationResult> {
    return this.withLock(async () => {
      const prompt = this.promptBuilder.buildGeneratePrompt({
        knowledgeBase: this.knowledgeBase,
        instruction: request.instruction,
        geometryType: request.geometryType,
        dataSchema: request.dataSchema ?? this.dataSchema,
      });

      const result = await this.runLlmPipeline({
        instruction: request.instruction,
        prompt,
        preserve: ['geometry_type', 'style_type'],
      });

      this.chatHistory.push({ role: 'user', content: request.instruction, timestamp: Date.now() });
      this.chatHistory.push({ role: 'assistant', content: result.explanation, timestamp: Date.now() });
      return result;
    });
  }

  async modify(request: ModifyRequest): Promise<GenerationResult> {
    return this.withLock(async () => {
      if (!this.params) {
        throw new SldAgentError('INVALID_REQUEST', 'No existing style to modify');
      }

      const preserve = request.preserve?.length
        ? request.preserve
        : ['geometry_type', 'style_type', 'field_name'];

      const prompt = this.promptBuilder.buildModifyPrompt({
        knowledgeBase: this.knowledgeBase,
        currentParams: this.params,
        instruction: request.instruction,
        geometryType: this.params.geometry_type,
        styleType: this.params.style_type,
        preserve,
        dataSchema: this.dataSchema,
      });

      const result = await this.runLlmPipeline({
        instruction: request.instruction,
        prompt,
        preserve,
      });

      this.chatHistory.push({ role: 'user', content: request.instruction, timestamp: Date.now() });
      this.chatHistory.push({ role: 'assistant', content: result.explanation, timestamp: Date.now() });
      return result;
    });
  }

  async applyPatch(request: ApplyPatchRequest): Promise<GenerationResult> {
    return this.withLock(async () => {
      if (!this.params) {
        throw new SldAgentError('INVALID_REQUEST', 'No existing style to patch');
      }

      const patched = applyPatches(this.params, request.patches);
      const validation = this.validator.validateParams(patched);
      if (!validation.valid) {
        throw new SldAgentError('SCHEMA_VALIDATION_FAILED', 'Patched params failed schema validation', {
          details: validation.errors,
        });
      }

      const normalized = this.normalizer.normalize(validation.params);
      return this.buildAndValidate(normalized, 'Applied parameter refinement');
    });
  }

  async importStyle(request: ImportStyleRequest): Promise<GenerationResult> {
    return this.withLock(async () => {
      const style = request.style as unknown as Style;
      const sldXml = await this.sldService.writeStyle(style);
      const validation = await this.sldService.validate(style, sldXml);
      this.currentStyle = structuredClone(style) as unknown as Style;
      this.lastValidStyle = structuredClone(style) as unknown as Style;
      this.lastValidSldXml = sldXml;
      // TODO: implement full Style -> StyleParams reverse mapping.
      // For MVP, derive a minimal params snapshot so the session remains usable.
      this.params = deriveMinimalParams(style, this.params);
      return {
        style: request.style,
        sldXml,
        params: this.params,
        validation,
        explanation: `Imported style from ${request.sourceName || 'unknown'}`,
      };
    });
  }

  async export(request: ExportRequest): Promise<ExportResult> {
    const style = (request.style as unknown as Style) ?? this.currentStyle;
    if (!style) {
      throw new SldAgentError('INVALID_REQUEST', 'No style to export');
    }
    const sldXml = await this.sldService.writeStyle(style);
    const validation = await this.sldService.validate(style, sldXml);
    return { sldXml, validation, generatedAt: Date.now() };
  }

  async validate(style?: SharedStyle): Promise<ValidationReport> {
    const target = (style as unknown as Style) ?? this.currentStyle;
    if (!target) {
      throw new SldAgentError('INVALID_REQUEST', 'No style to validate');
    }
    return this.sldService.validate(target);
  }

  getDomains(): DomainsResult {
    return { domains: this.knowledgeBase.domains, activeDomain: this.knowledgeBase.activeDomain };
  }

  async setDomain(domain: string): Promise<void> {
    const target = this.knowledgeBase.domains.find((d) => d.id === domain);
    if (!target) {
      throw new SldAgentError('DOMAIN_NOT_FOUND', `Domain ${domain} not found`);
    }
    this.knowledgeBase = { ...this.knowledgeBase, activeDomain: domain };
  }

  setDataSchema(schema: DataSchema): void {
    this.dataSchema = schema;
  }

  getState(): SessionState {
    return {
      id: this.id,
      activeDomain: this.knowledgeBase.activeDomain,
      dataSchema: this.dataSchema,
      currentStyle: this.currentStyle as unknown as SharedStyle,
      lastValidStyle: this.lastValidStyle as unknown as SharedStyle,
      lastValidSldXml: this.lastValidSldXml,
      chatHistory: [...this.chatHistory],
      params: this.params,
    };
  }

  private async runLlmPipeline(ctx: {
    instruction: string;
    prompt: string;
    preserve: string[];
  }): Promise<GenerationResult> {
    const raw = await this.llmClient.complete(ctx.prompt);
    const parsed = safeJsonParse(raw);
    if (!parsed) {
      throw new SldAgentError('SCHEMA_VALIDATION_FAILED', 'LLM output is not valid JSON');
    }

    const validation = this.validator.validateParams(parsed);
    if (!validation.valid) {
      throw new SldAgentError('SCHEMA_VALIDATION_FAILED', 'LLM output failed schema validation', {
        details: validation.errors,
      });
    }

    const normalized = this.normalizer.normalize(validation.params);
    const baseParams = this.params && isCompatible(this.params, normalized) ? this.params : undefined;
    const merged = baseParams ? mergeParams(baseParams, normalized, ctx.preserve) : normalized;

    return this.buildAndValidate(merged, `Generated style for: ${ctx.instruction}`);
  }

  private async buildAndValidate(params: StyleParams, explanation: string): Promise<GenerationResult> {
    const style = StyleBuilderFactory.create(params, {
      resolver: this.resolver,
      ruleGenerator: this.ruleGenerator,
      dataSchema: this.dataSchema,
      knowledgeBase: this.knowledgeBase,
    }).build();
    const sldXml = await this.sldService.writeStyle(style);
    const validation = await this.sldService.validate(style, sldXml);

    if (!validation.passed) {
      throw new SldAgentError(
        validation.xsd?.passed === false ? 'XSD_VALIDATION_FAILED' : 'ROUNDTRIP_VALIDATION_FAILED',
        validation.errors.map((e) => e.message).join('; ')
      );
    }

    this.currentStyle = structuredClone(style) as unknown as Style;
    this.lastValidStyle = structuredClone(style) as unknown as Style;
    this.lastValidSldXml = sldXml;
    this.params = structuredClone(params) as unknown as StyleParams;

    return {
      style: style as unknown as SharedStyle,
      sldXml,
      params,
      validation,
      explanation,
    };
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) {
      throw new SldAgentError('INVALID_REQUEST', 'Session is busy', { busy: true });
    }
    this.busy = true;
    try {
      return await fn();
    } catch (err) {
      this.rollback();
      throw err;
    } finally {
      this.busy = false;
    }
  }

  private rollback(): void {
    if (this.lastValidStyle) {
      this.currentStyle = structuredClone(this.lastValidStyle) as unknown as Style;
    } else {
      this.currentStyle = undefined;
      this.params = undefined;
    }
  }
}

function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  const json = trimmed.startsWith('```') ? extractJsonFromMarkdown(trimmed) : trimmed;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function extractJsonFromMarkdown(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : raw;
}

function isCompatible(a: StyleParams, b: StyleParams): boolean {
  return a.geometry_type === b.geometry_type || a.style_type === b.style_type;
}

function mergeParams(current: StyleParams, normalized: StyleParams, preserve: string[]): StyleParams {
  const merged = { ...(current as unknown as Record<string, unknown>), ...(normalized as unknown as Record<string, unknown>) };
  for (const field of preserve) {
    if (field in current) {
      merged[field] = (current as unknown as Record<string, unknown>)[field];
    }
  }
  return merged as unknown as StyleParams;
}

function applyPatches(params: StyleParams, patches: { op: string; path: string; value?: unknown }[]): StyleParams {
  const result = structuredClone(params) as unknown as Record<string, unknown>;
  for (const patch of patches) {
    if (patch.op === 'replace') {
      const path = patch.path.replace(/^\//, '').split('/');
      setPath(result, path, patch.value);
    }
  }
  return result as unknown as StyleParams;
}

function setPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

function deriveMinimalParams(style: Style, existing?: StyleParams): StyleParams {
  const firstRule = style.rules[0];
  const firstSymbolizer = ((firstRule?.symbolizers?.[0] as unknown) as Record<string, unknown> | undefined) ?? {};
  const geoType = symbolizerToGeometryType(firstSymbolizer.kind as string) ?? existing?.geometry_type ?? 'point';
  const styleType = existing?.style_type ?? 'simple';

  const params: StyleParams = {
    style_name: style.name,
    geometry_type: geoType,
    style_type: styleType,
  };

  if (firstSymbolizer?.kind === 'Mark') {
    params.well_known_name = (firstSymbolizer.wellKnownName as typeof params.well_known_name) ?? 'circle';
    params.size = (firstSymbolizer.size as number) ?? existing?.size ?? 6;
    params.fill_color = (firstSymbolizer.color as string) ?? existing?.fill_color;
    params.stroke_color = (firstSymbolizer.strokeColor as string) ?? existing?.stroke_color;
    params.stroke_width = (firstSymbolizer.strokeWidth as number) ?? existing?.stroke_width;
    params.rotation = (firstSymbolizer.rotate as number) ?? existing?.rotation;
  } else if (firstSymbolizer?.kind === 'Line') {
    params.stroke_color = (firstSymbolizer.color as string) ?? existing?.stroke_color;
    params.stroke_width = (firstSymbolizer.width as number) ?? existing?.stroke_width;
    params.stroke_opacity = (firstSymbolizer.opacity as number) ?? existing?.stroke_opacity;
    params.stroke_dasharray = (firstSymbolizer.dasharray as string) ?? existing?.stroke_dasharray;
    params.stroke_linecap = (firstSymbolizer.lineCap as typeof params.stroke_linecap) ?? existing?.stroke_linecap;
    params.stroke_linejoin = (firstSymbolizer.lineJoin as typeof params.stroke_linejoin) ?? existing?.stroke_linejoin;
  } else if (firstSymbolizer?.kind === 'Fill') {
    params.fill_color = (firstSymbolizer.color as string) ?? existing?.fill_color;
    params.fill_opacity = (firstSymbolizer.opacity as number) ?? existing?.fill_opacity;
    params.stroke_color = (firstSymbolizer.outlineColor as string) ?? existing?.stroke_color;
    params.stroke_width = (firstSymbolizer.outlineWidth as number) ?? existing?.stroke_width;
  } else if (firstSymbolizer?.kind === 'Text') {
    params.style_type = 'text';
    params.label = (firstSymbolizer.label as string) ?? existing?.label;
    params.font_family = (firstSymbolizer.font as string[])?.[0] ?? existing?.font_family;
    params.font_size = (firstSymbolizer.size as number) ?? existing?.font_size;
    params.stroke_color = (firstSymbolizer.color as string) ?? existing?.stroke_color;
    params.halo_color = (firstSymbolizer.haloColor as string) ?? existing?.halo_color;
    params.halo_radius = (firstSymbolizer.haloWidth as number) ?? existing?.halo_radius;
  }

  return params;
}

function symbolizerToGeometryType(kind?: string): 'point' | 'line' | 'polygon' | 'raster' | undefined {
  switch (kind) {
    case 'Mark':
    case 'Icon':
      return 'point';
    case 'Line':
      return 'line';
    case 'Fill':
      return 'polygon';
    case 'Raster':
      return 'raster';
    default:
      return undefined;
  }
}
