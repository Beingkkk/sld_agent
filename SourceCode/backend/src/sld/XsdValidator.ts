import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SldServiceOptions, ValidationResult } from '@sldagent/shared/types';

/**
 * OGC SLD 1.0.0 XSD 校验器。
 *
 * 优先使用 xmllint-wasm + 本地 schema bundle，其次回退到系统 xmllint，
 * 最后按配置选择跳过或直接失败。
 */
export class XsdValidator {
  private options: SldServiceOptions;

  constructor(options: SldServiceOptions = {}) {
    const bundleDir = options.wasmSchemaBundleDir ?? resolveSchemaBundleDir();
    this.options = {
      ...options,
      wasmSchemaBundleDir: bundleDir,
    };
  }

  async validate(xml: string): Promise<ValidationResult> {
    const start = Date.now();

    // 1. Try xmllint-wasm bundle when available (default production path).
    if (this.options.wasmSchemaBundleDir && this.options.useWasm !== false) {
      try {
        return await validateWithWasm(xml, this.options.wasmSchemaBundleDir, start);
      } catch (err) {
        if (!this.options.skipXsd) {
          return {
            passed: false,
            durationMs: Date.now() - start,
            tool: 'xmllint-wasm',
            message: `Wasm XSD validation failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    }

    // 2. Try system xmllint if XSD path is provided.
    if (this.options.xsdPath) {
      try {
        return await validateWithSystemXmllint(xml, this.options.xsdPath, this.options.xmllintPath, start);
      } catch (err) {
        if (!this.options.skipXsd) {
          return {
            passed: false,
            durationMs: Date.now() - start,
            tool: 'xmllint',
            message: `System XSD validation failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    }

    // 3. Skip if allowed.
    if (this.options.skipXsd ?? true) {
      return {
        passed: true,
        tool: 'none',
        message: 'XSD validation skipped (no validator configured)',
      };
    }

    return {
      passed: false,
      durationMs: Date.now() - start,
      tool: 'none',
      message: 'XSD validation not configured and skipXsd is false',
    };
  }
}

function resolveSchemaBundleDir(): string | undefined {
  if (process.env.SLD_SCHEMA_DIR) {
    return process.env.SLD_SCHEMA_DIR;
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(__dirname, '../resources/sld-schemas'),
    resolve(__dirname, '../../resources/sld-schemas'),
  ];

  for (const dir of candidates) {
    try {
      if (statSync(dir).isDirectory()) {
        return dir;
      }
    } catch {
      // Directory does not exist or is not accessible; try next candidate.
    }
  }

  return undefined;
}

async function validateWithSystemXmllint(
  xml: string,
  xsdPath: string,
  xmllintPath: string | undefined,
  start: number
): Promise<ValidationResult> {
  const { execFile } = await import('node:child_process');
  const { writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const tmpFile = join(tmpdir(), `sld-${Date.now()}.xml`);
  await writeFile(tmpFile, xml, 'utf-8');

  return new Promise((resolvePromise, reject) => {
    execFile(xmllintPath || 'xmllint', ['--noout', '--schema', xsdPath, tmpFile], (err, _stdout, stderr) => {
      if (err && err.code !== 0) {
        reject(new Error(stderr || err.message));
      } else {
        resolvePromise({
          passed: true,
          durationMs: Date.now() - start,
          tool: xmllintPath || 'xmllint',
        });
      }
    });
  });
}

async function validateWithWasm(
  xml: string,
  bundleDir: string,
  start: number
): Promise<ValidationResult> {
  const { validateXML } = await import('xmllint-wasm');
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');

  const files = await readdir(bundleDir);
  const schemaFile = files.find((f) => f.toLowerCase().includes('styledlayerdescriptor') && f.endsWith('.xsd'));
  if (!schemaFile) {
    throw new Error('No StyledLayerDescriptor.xsd found in wasm schema bundle');
  }

  const preload = await Promise.all(
    files
      .filter((f) => f.endsWith('.xsd') && f !== schemaFile)
      .map(async (file) => ({
        fileName: file,
        contents: await readFile(join(bundleDir, file), 'utf-8'),
      }))
  );

  const result = await validateXML({
    xml: [{ fileName: 'sld.xml', contents: xml }],
    schema: [{ fileName: schemaFile, contents: await readFile(join(bundleDir, schemaFile), 'utf-8') }],
    preload,
  });

  if (!result.valid) {
    const messages = result.errors.map((e) => e.message).join('; ');
    throw new Error(messages);
  }

  return {
    passed: true,
    durationMs: Date.now() - start,
    tool: 'xmllint-wasm',
  };
}
