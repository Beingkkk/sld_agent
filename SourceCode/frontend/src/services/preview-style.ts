import {
  Style,
  Fill,
  Stroke,
  Circle as CircleStyle,
  Text as TextStyle,
} from 'ol/style';
import OpenLayersParser from 'geostyler-openlayers-parser';

export type PreviewGeometryType = 'Mark' | 'Line' | 'Fill' | 'Text';

export interface ApplyStyleResult {
  style: any;
  debug: string;
}

function clonePlain<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * 从 Store 的 transformResult 中提取纯 JSON 的 GeoStyler Style。
 * 用 JSON 深拷贝解除 Vue Proxy，避免第三方 parser 在 structuredClone 时报错。
 */
export function getGeoStylerStyle(transformResult: any): any {
  try {
    const style = transformResult?.geoStyler;
    if (!style) return null;
    return clonePlain(style);
  } catch {
    return null;
  }
}

function createMarkFallbackStyle(): Style {
  return new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: '#f87171' }),
      stroke: new Stroke({ color: '#0d1117', width: 1 }),
    }),
  });
}

function createTextFallbackStyle(): TextStyle {
  return new TextStyle({
    font: '12px "IBM Plex Sans", sans-serif',
    fill: new Fill({ color: '#e6edf3' }),
    stroke: new Stroke({ color: '#0d1117', width: 2 }),
    offsetY: -12,
  });
}

/**
 * 当 parser 失败或无样式时使用的兜底样式。
 * Text 类型需要按 feature 动态读取 `name` 属性，因此返回 StyleFunction。
 */
export function createFallbackStyle(geomType: PreviewGeometryType): any {
  switch (geomType) {
    case 'Mark':
      return createMarkFallbackStyle();
    case 'Text':
      return (feature: any) => {
        const base = createMarkFallbackStyle();
        const label = feature.get('name') || '';
        const text = createTextFallbackStyle();
        text.setText(String(label));
        return [base, text];
      };
    case 'Line':
      return new Style({
        stroke: new Stroke({ color: '#f87171', width: 3 }),
      });
    case 'Fill':
      return new Style({
        fill: new Fill({ color: 'rgba(45, 212, 191, 0.35)' }),
        stroke: new Stroke({ color: '#2dd4bf', width: 1.5 }),
      });
    default:
      return createMarkFallbackStyle();
  }
}

/**
 * OpenLayers 10 对直接传入的 Style 实例在部分场景下（Mark/Line/Fill）
 * 会走 flat-style 转换并抛错；Text 返回的 StyleFunction 却能正常渲染。
 * 把 Style / Style[] 统一包装成 StyleFunction 可绕过该问题。
 */
export function normalizeOlStyle(olStyle: any): any {
  if (typeof olStyle === 'function') {
    return olStyle;
  }
  if (Array.isArray(olStyle)) {
    return () => olStyle;
  }
  return () => olStyle;
}

/**
 * 将 GeoStyler Style 转换为 OpenLayers 可渲染的样式。
 * 失败或输入为空时返回兜底样式与调试信息。
 */
export async function applyPreviewStyle(
  geoStylerStyle: any,
  geomType: PreviewGeometryType,
): Promise<ApplyStyleResult> {
  if (!geoStylerStyle) {
    return {
      style: createFallbackStyle(geomType),
      debug: 'fallback: no geoStyler style',
    };
  }

  try {
    const parser = new OpenLayersParser();
    const { output: olStyle, errors } = await parser.writeStyle(geoStylerStyle as any);

    if (errors && errors.length > 0) {
      console.warn('OpenLayers parser warnings:', errors);
    }

    if (olStyle) {
      const wrapped = normalizeOlStyle(olStyle);
      return {
        style: wrapped,
        debug: `parser ok (${Array.isArray(olStyle) ? olStyle.length + ' styles' : '1 style'}, fn)`,
      };
    }

    return {
      style: createFallbackStyle(geomType),
      debug: 'fallback: parser returned no style',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Style application error:', e);
    return {
      style: createFallbackStyle(geomType),
      debug: `fallback: ${msg}`,
    };
  }
}
