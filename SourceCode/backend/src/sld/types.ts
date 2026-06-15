import type { Style } from 'geostyler-style';

export interface SldServiceOptions {
  xsdPath?: string;
  xmllintPath?: string;
  skipXsd?: boolean;
  wasmSchemaBundleDir?: string;
  useWasm?: boolean;
}

export interface WriteOptions {
  includeXmlDeclaration?: boolean;
  prettyPrint?: boolean;
  encoding?: string;
}

export interface ValidationReport {
  passed: boolean;
  schema?: ValidationResult;
  xsd?: ValidationResult;
  roundtrip?: ValidationResult;
  errors: ValidationError[];
}

export interface ValidationResult {
  passed: boolean;
  durationMs?: number;
  tool?: string;
  message?: string;
}

export interface ValidationError {
  source: 'schema' | 'xsd' | 'roundtrip' | 'builder';
  message: string;
  location?: string;
  meta?: unknown;
}

export interface ISldService {
  writeStyle(style: Style, options?: WriteOptions): Promise<string>;
  readStyle(xml: string): Promise<Style>;
  validate(style: Style, xml?: string): Promise<ValidationReport>;
  validateXsd(xml: string): Promise<ValidationResult>;
  validateRoundtrip(style: Style, xml?: string): Promise<ValidationResult>;
}
