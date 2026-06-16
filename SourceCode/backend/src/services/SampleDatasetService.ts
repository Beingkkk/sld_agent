import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import shapefile from 'shapefile';
import type {
  SampleDatasetInfo,
  SampleDatasetData,
  GeoJSONFeatureCollection,
} from '@sldagent/shared/types';

const DATASET_ID_PATTERN = /^sld_cookbook_(point|line|polygon|linestring|polyline)$/;
const GEOMETRY_TYPE_MAP: Record<string, 'point' | 'line' | 'polygon' | undefined> = {
  point: 'point',
  line: 'line',
  linestring: 'line',
  polyline: 'line',
  polygon: 'polygon',
};

export class SampleDatasetService {
  constructor(private dataDir: string) {}

  async listDatasets(): Promise<{ datasets: SampleDatasetInfo[] }> {
    const entries = await readdir(this.dataDir, { withFileTypes: true });
    const datasets: SampleDatasetInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const info = await this.inspectDataset(entry.name);
      if (info) datasets.push(info);
    }

    datasets.sort((a, b) => a.id.localeCompare(b.id));
    return { datasets };
  }

  async loadDataset(id: string): Promise<SampleDatasetData> {
    const info = await this.inspectDataset(id);
    if (!info) {
      throw new Error(`Dataset not found: ${id}`);
    }

    const dirPath = join(this.dataDir, id);
    const shpPath = join(dirPath, `${id}.shp`);
    const collection = await shapefile.read(shpPath);

    const geojson: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: collection.features as GeoJSONFeatureCollection['features'],
    };

    const extent = this.computeExtent(geojson) ?? collection.bbox ?? [0, 0, 0, 0];

    return {
      id: info.id,
      name: info.name,
      geometryType: info.geometryType,
      crs: info.crs,
      featureCount: info.featureCount,
      geojson,
      extent: extent as [number, number, number, number],
    };
  }

  private async inspectDataset(name: string): Promise<SampleDatasetInfo | undefined> {
    const match = name.match(DATASET_ID_PATTERN);
    if (!match) return undefined;

    const dirPath = join(this.dataDir, name);
    const shpPath = join(dirPath, `${name}.shp`);
    const dbfPath = join(dirPath, `${name}.dbf`);
    const prjPath = join(dirPath, `${name}.prj`);

    if (!await fileExists(shpPath) || !await fileExists(dbfPath)) {
      return undefined;
    }

    const geometryType = GEOMETRY_TYPE_MAP[match[1]] ?? 'point';
    const crs = await this.readCrs(prjPath);
    const featureCount = await this.countFeatures(shpPath);

    return {
      id: name,
      name: this.formatName(name),
      geometryType,
      crs,
      featureCount,
      path: relative(process.cwd(), dirPath),
    };
  }

  private async readCrs(prjPath: string): Promise<string> {
    try {
      const wkt = await readFile(prjPath, 'utf-8');
      return this.inferEpsgFromWkt(wkt);
    } catch {
      return 'EPSG:4326';
    }
  }

  private inferEpsgFromWkt(wkt: string): string {
    const upper = wkt.toUpperCase();
    if (upper.includes('WGS_1984') || upper.includes('WGS 84') || upper.includes('GCS_WGS_1984')) {
      return 'EPSG:4326';
    }
    if (upper.includes('WEB_MERCATOR') || upper.includes('WORLD_MERCATOR') || upper.includes('EPSG:3857')) {
      return 'EPSG:3857';
    }
    return 'EPSG:4326';
  }

  private async countFeatures(shpPath: string): Promise<number> {
    try {
      const source = await shapefile.open(shpPath);
      let count = 0;
      let result = await source.read();
      while (!result.done) {
        count++;
        result = await source.read();
      }
      return count;
    } catch {
      return 0;
    }
  }

  private computeExtent(geojson: GeoJSONFeatureCollection): [number, number, number, number] | undefined {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasCoords = false;

    for (const feature of geojson.features) {
      const coords = this.extractCoordinates(feature.geometry);
      for (const [x, y] of coords) {
        hasCoords = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    return hasCoords ? [minX, minY, maxX, maxY] : undefined;
  }

  private extractCoordinates(geometry: unknown): [number, number][] {
    const geom = geometry as { type: string; coordinates: unknown } | undefined;
    if (!geom) return [];

    switch (geom.type) {
      case 'Point':
        return [geom.coordinates as [number, number]];
      case 'MultiPoint':
      case 'LineString':
        return geom.coordinates as [number, number][];
      case 'Polygon':
        return (geom.coordinates as [number, number][][]).flat();
      case 'MultiLineString':
        return (geom.coordinates as [number, number][][]).flat();
      case 'MultiPolygon':
        return (geom.coordinates as [number, number][][][]).flat(2);
      default:
        return [];
    }
  }

  private formatName(id: string): string {
    return id
      .replace(/^sld_cookbook_/, '')
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, { flag: 'r' });
    return true;
  } catch {
    return false;
  }
}
