import SldParser from 'geostyler-sld-parser';
import type { Style } from 'geostyler-style';
import type { WriteOptions } from '@sldagent/shared/types';

/**
 * 封装 geostyler-sld-parser 的 SLD 写出与读入。
 *
 * 读入时会先剥离 symbolizer 内部显式的 <Geometry> 节点，以绕过
 * geostyler-sld-parser@9.0.1 的解析崩溃问题。
 */
export class SldParserWrapper {
  private parser = new SldParser();

  async writeStyle(style: Style, options?: WriteOptions): Promise<string> {
    const { output } = await this.parser.writeStyle(style);
    if (!output) {
      throw new Error('geostyler-sld-parser returned empty output');
    }

    const pretty = options?.prettyPrint ?? true;
    if (pretty) {
      const { default: format } = await import('xml-formatter');
      return format(output, { indentation: '  ', collapseContent: true });
    }

    return output;
  }

  async readStyle(xml: string): Promise<Style> {
    const cleaned = stripSymbolizerGeometry(xml);
    const { output, errors } = await this.parser.readStyle(cleaned);
    if (errors?.length) {
      throw new Error(`Failed to parse SLD: ${errors.map((e) => e.message).join(', ')}`);
    }
    return output as Style;
  }
}

function stripSymbolizerGeometry(xml: string): string {
  return xml.replace(/<\w*:?Geometry\b[^>]*>[\s\S]*?<\/\w*:?Geometry\s*>/g, '');
}
