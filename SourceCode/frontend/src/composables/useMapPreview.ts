import type VectorLayer from 'ol/layer/Vector';

export function useMapPreview() {
  async function applyStyle(layer: VectorLayer<any>, style: unknown) {
    const { default: OpenLayersParser } = await import('geostyler-openlayers-parser');
    const parser = new OpenLayersParser();
    const { output: olStyle } = await parser.writeStyle(style as never);
    layer.setStyle(olStyle);
  }

  return { applyStyle };
}
