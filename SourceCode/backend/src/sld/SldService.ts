import type { Style } from 'geostyler-style';
import type {
  SldServiceOptions,
  WriteOptions,
  ValidationReport,
  ValidationResult,
} from '@sldagent/shared/types';
import { RoundtripValidator } from './RoundtripValidator.js';
import { SldParserWrapper } from './SldParserWrapper.js';
import { ValidationReporter } from './ValidationReporter.js';
import { XsdValidator } from './XsdValidator.js';

export { SldServiceOptions, WriteOptions, ValidationReport, ValidationResult };

export interface ISldService {
  writeStyle(style: Style, options?: WriteOptions): Promise<string>;
  readStyle(xml: string): Promise<Style>;
  validate(style: Style, xml?: string): Promise<ValidationReport>;
  validateXsd(xml: string): Promise<ValidationResult>;
  validateRoundtrip(style: Style, xml?: string): Promise<ValidationResult>;
}

export class SldService implements ISldService {
  private parser = new SldParserWrapper();
  private xsdValidator: XsdValidator;
  private roundtripValidator: RoundtripValidator;
  private reporter = new ValidationReporter();

  constructor(options: SldServiceOptions = {}) {
    this.xsdValidator = new XsdValidator(options);
    this.roundtripValidator = new RoundtripValidator(this.parser);
  }

  async writeStyle(style: Style, options?: WriteOptions): Promise<string> {
    return this.parser.writeStyle(style, options);
  }

  async readStyle(xml: string): Promise<Style> {
    return this.parser.readStyle(xml);
  }

  async validate(style: Style, xml?: string): Promise<ValidationReport> {
    let sldXml: string;
    try {
      sldXml = xml ?? (await this.writeStyle(style));
    } catch (err) {
      return this.reporter.report({
        xsd: {
          passed: false,
          message: `Failed to write SLD: ${err instanceof Error ? err.message : String(err)}`,
          tool: 'geostyler-sld-parser',
        },
      });
    }

    const [xsd, roundtrip] = await Promise.all([
      this.validateXsd(sldXml),
      this.validateRoundtrip(style, sldXml),
    ]);

    return this.reporter.report({ xsd, roundtrip });
  }

  async validateXsd(xml: string): Promise<ValidationResult> {
    return this.xsdValidator.validate(xml);
  }

  async validateRoundtrip(style: Style, xml?: string): Promise<ValidationResult> {
    return this.roundtripValidator.validate(style, xml);
  }
}

export function createSldService(options?: SldServiceOptions): ISldService {
  return new SldService(options);
}
