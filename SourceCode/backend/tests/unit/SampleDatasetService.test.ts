import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { SampleDatasetService } from '../../src/services/SampleDatasetService.js';

const DATA_DIR = fileURLToPath(new URL('../../../data', import.meta.url));

describe('SampleDatasetService', () => {
  let service: SampleDatasetService;

  beforeAll(() => {
    service = new SampleDatasetService(DATA_DIR);
  });

  it('lists sample datasets from SourceCode/data', async () => {
    const { datasets } = await service.listDatasets();

    expect(datasets.length).toBeGreaterThanOrEqual(3);
    const ids = datasets.map((d) => d.id).sort();
    expect(ids).toContain('sld_cookbook_point');
    expect(ids).toContain('sld_cookbook_line');
    expect(ids).toContain('sld_cookbook_polygon');
  });

  it('returns correct metadata for each geometry type', async () => {
    const { datasets } = await service.listDatasets();

    const pointDataset = datasets.find((d) => d.geometryType === 'point');
    expect(pointDataset).toBeDefined();
    expect(pointDataset!.featureCount).toBeGreaterThan(0);
    expect(pointDataset!.crs).toBe('EPSG:4326');

    const lineDataset = datasets.find((d) => d.geometryType === 'line');
    expect(lineDataset).toBeDefined();
    expect(lineDataset!.featureCount).toBeGreaterThan(0);

    const polygonDataset = datasets.find((d) => d.geometryType === 'polygon');
    expect(polygonDataset).toBeDefined();
    expect(polygonDataset!.featureCount).toBeGreaterThan(0);
  });

  it('loads point dataset as GeoJSON FeatureCollection', async () => {
    const data = await service.loadDataset('sld_cookbook_point');

    expect(data.geometryType).toBe('point');
    expect(data.crs).toBe('EPSG:4326');
    expect(data.geojson.type).toBe('FeatureCollection');
    expect(data.geojson.features.length).toBe(data.featureCount);
    expect(data.extent.length).toBe(4);
    expect(data.extent[0]).toBeLessThanOrEqual(data.extent[2]);
    expect(data.extent[1]).toBeLessThanOrEqual(data.extent[3]);
  });

  it('loads line dataset as GeoJSON FeatureCollection', async () => {
    const data = await service.loadDataset('sld_cookbook_line');

    expect(data.geometryType).toBe('line');
    expect(data.geojson.type).toBe('FeatureCollection');
    expect(data.geojson.features.length).toBeGreaterThan(0);
  });

  it('loads polygon dataset as GeoJSON FeatureCollection', async () => {
    const data = await service.loadDataset('sld_cookbook_polygon');

    expect(data.geometryType).toBe('polygon');
    expect(data.geojson.type).toBe('FeatureCollection');
    expect(data.geojson.features.length).toBeGreaterThan(0);
  });

  it('throws for unknown dataset id', async () => {
    await expect(service.loadDataset('nonexistent_dataset')).rejects.toThrow('Dataset not found');
  });
});
