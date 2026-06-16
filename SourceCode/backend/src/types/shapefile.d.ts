declare module 'shapefile' {
  export interface ReadOptions {
    encoding?: string;
    highWaterMark?: number;
  }

  export interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSON.Feature[];
    bbox?: [number, number, number, number];
  }

  export function read(shp: string, dbf?: string | null, options?: ReadOptions): Promise<GeoJSONFeatureCollection>;
  export function read(shp: string, options?: ReadOptions): Promise<GeoJSONFeatureCollection>;
  export function open(shp: string, dbf?: string | null, options?: ReadOptions): Promise<Source>;
  export function openShp(shp: string, options?: ReadOptions): Promise<Source>;
  export function openDbf(dbf: string, options?: ReadOptions): Promise<Source>;

  export interface Source {
    bbox: [number, number, number, number];
    read(): Promise<{ done: boolean; value?: GeoJSON.Feature }>;
    cancel(): Promise<void>;
  }
}
