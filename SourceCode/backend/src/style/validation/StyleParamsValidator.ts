import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import type { StyleParams, ValidationError } from '@sldagent/shared/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(resolve(__dirname, './style-params.schema.json'), 'utf-8'));

const ajv = new Ajv({ strict: true, allErrors: true });

export class StyleParamsValidator {
  private validate = ajv.compile<StyleParams>(schema);

  validateParams(data: unknown): { valid: true; params: StyleParams } | { valid: false; errors: ValidationError[] } {
    const valid = this.validate(data);
    if (valid) {
      return { valid: true, params: data as StyleParams };
    }
    const errors = (this.validate.errors || []).map((e) => ({
      source: 'schema' as const,
      message: `${e.instancePath || '/'}: ${e.message || 'validation failed'}`,
      location: e.instancePath,
    }));
    return { valid: false, errors };
  }
}
