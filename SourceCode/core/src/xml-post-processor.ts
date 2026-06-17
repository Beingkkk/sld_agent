import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { SLDRoot, FeatureTypeStyleMeta } from './types.js';

const XML_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
};

const FORMAT_OPTIONS = {
  ...XML_OPTIONS,
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
  processEntities: true,
};

export class XMLPostProcessor {
  /**
   * Assemble a full SLD XML document by wrapping the parser-generated SLD fragment
   * with NamedLayer, UserStyle, and FeatureTypeStyle containers, and injecting
   * extension metadata (title, abstract, featureTypeName, etc.).
   */
  static assembleFullSLD(tree: SLDRoot, parserSldXml: string): string {
    const namedLayer = tree.namedLayer;
    const userStyle = namedLayer.children[0];

    // Build FeatureTypeStyle elements with metadata
    const featureTypeStyles: string[] = [];
    for (const fts of userStyle.children) {
      const titleAttr = fts.data.title ? `\n      <sld:Title>${this.escapeXml(fts.data.title)}</sld:Title>` : '';
      const abstractAttr = fts.data.abstract ? `\n      <sld:Abstract>${this.escapeXml(fts.data.abstract)}</sld:Abstract>` : '';
      const ftNameAttr = fts.data.featureTypeName
        ? `\n      <sld:FeatureTypeName>${this.escapeXml(fts.data.featureTypeName)}</sld:FeatureTypeName>`
        : '';

      // Extract the inner content of the parser-generated SLD (Rules and Symbolizers)
      // The parser generates a full SLD with FeatureTypeStyle wrapper; we need to extract
      // the inner rule content. For MVP, we wrap the entire parser output per FTS.
      // Since we generate one GeoStyler style per FTS, the parser output is a single
      // FeatureTypeStyle. We extract its inner content.
      const innerContent = this.extractFeatureTypeStyleContent(parserSldXml);

      const ftsXml = `    <sld:FeatureTypeStyle>${titleAttr}${abstractAttr}${ftNameAttr}\n${innerContent}\n    </sld:FeatureTypeStyle>`;
      featureTypeStyles.push(ftsXml);
    }

    const userStyleTitle = userStyle.data.title
      ? `\n      <sld:Title>${this.escapeXml(userStyle.data.title)}</sld:Title>`
      : '';
    const userStyleAbstract = userStyle.data.abstract
      ? `\n      <sld:Abstract>${this.escapeXml(userStyle.data.abstract)}</sld:Abstract>`
      : '';
    const isDefaultAttr = userStyle.data.isDefault ? ' isDefault="true"' : '';

    const fullXml = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:sld="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:gml="http://www.opengis.net/gml">
  <sld:NamedLayer>
    <sld:Name>${this.escapeXml(namedLayer.data.name)}</sld:Name>
    <sld:UserStyle${isDefaultAttr}>
      <sld:Name>${this.escapeXml(userStyle.data.name)}</sld:Name>${userStyleTitle}${userStyleAbstract}
${featureTypeStyles.join('\n')}
    </sld:UserStyle>
  </sld:NamedLayer>
</StyledLayerDescriptor>`;

    return this.formatXml(fullXml);
  }

  /**
   * Pretty-print an XML string using fast-xml-parser.
   * This ensures the SLD output is consistently indented for display and export.
   */
  private static formatXml(xml: string): string {
    try {
      const parser = new XMLParser({
        ...XML_OPTIONS,
        preserveOrder: false,
      });
      const parsed = parser.parse(xml);
      const builder = new XMLBuilder(FORMAT_OPTIONS);
      return builder.build(parsed) as string;
    } catch {
      // If formatting fails for any reason, return the original XML unchanged.
      return xml;
    }
  }

  /**
   * Extract metadata from an existing SLD XML file for import.
   * Returns an array of FeatureTypeStyleMeta in order.
   */
  static extractMetaFromSLD(xml: string): FeatureTypeStyleMeta[] {
    const parser = new XMLParser({
      ...XML_OPTIONS,
      preserveOrder: false,
    });

    try {
      const parsed = parser.parse(xml);
      const sld = parsed.StyledLayerDescriptor || parsed;
      const namedLayer = sld.NamedLayer || sld['sld:NamedLayer'];
      if (!namedLayer) return [{ title: '', abstract: '', featureTypeName: '' }];

      const userStyle = namedLayer.UserStyle || namedLayer['sld:UserStyle'];
      if (!userStyle) return [{ title: '', abstract: '', featureTypeName: '' }];

      const ftsList = Array.isArray(userStyle.FeatureTypeStyle)
        ? userStyle.FeatureTypeStyle
        : userStyle.FeatureTypeStyle
          ? [userStyle.FeatureTypeStyle]
          : [];

      const metaList: FeatureTypeStyleMeta[] = [];
      for (const fts of ftsList) {
        const ftsObj = fts['sld:FeatureTypeStyle'] || fts;
        metaList.push({
          title: this.extractText(ftsObj, 'Title', 'sld:Title'),
          abstract: this.extractText(ftsObj, 'Abstract', 'sld:Abstract'),
          featureTypeName: this.extractText(ftsObj, 'FeatureTypeName', 'sld:FeatureTypeName'),
        });
      }

      return metaList.length > 0 ? metaList : [{ title: '', abstract: '', featureTypeName: '' }];
    } catch {
      return [{ title: '', abstract: '', featureTypeName: '' }];
    }
  }

  private static extractText(obj: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      if (obj[key] !== undefined) {
        const val = obj[key];
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object' && '#text' in val) {
          return (val as Record<string, unknown>)['#text'] as string;
        }
      }
    }
    return '';
  }

  private static extractFeatureTypeStyleContent(parserSldXml: string): string {
    // The parser generates something like:
    // <?xml ...><sld:StyledLayerDescriptor ...><sld:NamedLayer>...<sld:UserStyle>...<sld:FeatureTypeStyle>...</sld:FeatureTypeStyle>...</sld:UserStyle>...</sld:NamedLayer></sld:StyledLayerDescriptor>
    // We need to extract the content inside <sld:FeatureTypeStyle> tags.
    // For MVP, a simple regex-based extraction is sufficient since the parser output is well-formed.
    const match = parserSldXml.match(/<sld:FeatureTypeStyle[^>]*>([\s\S]*?)<\/sld:FeatureTypeStyle>/);
    if (match) {
      // Indent the content
      return match[1]
        .split('\n')
        .map((line) => (line.trim() ? '      ' + line.trimStart() : ''))
        .join('\n');
    }

    // Fallback: if no FeatureTypeStyle wrapper found, return the whole thing indented
    return parserSldXml
      .split('\n')
      .map((line) => (line.trim() ? '      ' + line.trimStart() : ''))
      .join('\n');
  }

  private static escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
