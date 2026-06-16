export interface Style {
  name: string;
  rules: Rule[];
  metadata?: Record<string, unknown>;
}

export interface Rule {
  name: string;
  filter?: unknown;
  scaleDenominator?: unknown;
  symbolizers: unknown[];
  elseRule?: boolean;
}

export interface Symbolizer {
  kind: 'Mark' | 'Line' | 'Fill' | 'Text' | 'Raster';
  [key: string]: unknown;
}

export interface SldServiceOptions {
  xsdPath?: string;
  xmllintPath?: string;
  skipXsd?: boolean;
  wasmSchemaBundleDir?: string;
  useWasm?: boolean;
}

export interface WriteOptions {
  includeXmlDeclaration?: boolean;
  prettyPrint?: boolean;
  encoding?: string;
}

export interface DataSchema {
  properties: PropertySchema[];
  geometryType?: 'point' | 'line' | 'polygon' | 'raster';
  sampleCount?: number;
}

export interface PropertySchema {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'date';
  samples?: unknown[];
  min?: number;
  max?: number;
}

export interface ValidationReport {
  passed: boolean;
  schema?: ValidationResult;
  xsd?: ValidationResult;
  roundtrip?: ValidationResult;
  errors: ValidationError[];
}

export interface ValidationResult {
  passed: boolean;
  durationMs?: number;
  tool?: string;
  message?: string;
}

export interface ValidationError {
  source: 'schema' | 'xsd' | 'roundtrip' | 'builder';
  message: string;
  location?: string;
  meta?: unknown;
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'LLM_ERROR'
  | 'BUILDER_ERROR'
  | 'SLD_PARSE_ERROR'
  | 'XSD_VALIDATION_FAILED'
  | 'ROUNDTRIP_VALIDATION_FAILED'
  | 'DOMAIN_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface SldAgentErrorDetails {
  busy?: boolean;
  details?: unknown;
  cause?: unknown;
}

export interface GenerateRequest {
  instruction: string;
  geometryType: 'point' | 'line' | 'polygon' | 'raster';
  domain?: string;
  dataSchema?: DataSchema;
}

export interface ModifyRequest {
  instruction: string;
  preserve?: string[];
}

export interface StylePatch {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?: unknown;
}

export interface ApplyPatchRequest {
  patches: StylePatch[];
}

export interface ImportStyleRequest {
  style: Style;
  sourceName?: string;
}

export interface ExportRequest {
  style?: Style;
  options?: {
    includeXmlDeclaration?: boolean;
    prettyPrint?: boolean;
    encoding?: string;
  };
}

export interface GenerationResult {
  style: Style;
  sldXml: string;
  params: StyleParams;
  validation: ValidationReport;
  explanation: string;
}

export interface ExportResult {
  sldXml: string;
  validation: ValidationReport;
  generatedAt: number;
}

export interface DomainInfo {
  id: string;
  name: string;
  description: string;
  default: boolean;
}

export interface DomainsResult {
  domains: DomainInfo[];
  activeDomain: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface StyleParams {
  style_name: string;
  geometry_type: 'point' | 'line' | 'polygon' | 'raster';
  style_type: 'simple' | 'categorized' | 'classified' | 'text' | 'raster';
  field_name?: string;
  fill_color?: string;
  fill_opacity?: number;
  stroke_color?: string;
  stroke_width?: number;
  stroke_opacity?: number;
  stroke_dasharray?: string;
  stroke_linecap?: 'butt' | 'round' | 'square';
  stroke_linejoin?: 'miter' | 'round' | 'bevel';
  opacity?: number;
  well_known_name?: 'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'x';
  size?: number;
  rotation?: number;
  line_offset?: number;
  categories?: CategoryDef[];
  classes?: number;
  classification_method?: 'equalInterval' | 'quantile' | 'naturalBreaks';
  color_ramp?: string[];
  color_scheme?: string;
  label?: string;
  font_family?: string;
  font_size?: number;
  font_weight?: 'normal' | 'bold';
  font_style?: 'normal' | 'italic' | 'oblique';
  halo_color?: string;
  halo_radius?: number;
  placement?: 'point' | 'line';
  offset?: [number, number];
  rules?: RuleParams[];
  min_scale?: number;
  max_scale?: number;
}

export interface CategoryDef {
  value: string | number | boolean;
  label?: string;
  fill_color?: string;
  stroke_color?: string;
  stroke_width?: number;
}

export interface RuleParams {
  name?: string;
  filter?: unknown;
  min_scale?: number;
  max_scale?: number;
  symbolizers?: SymbolizerParams[];
}

export interface SymbolizerParams {
  kind: 'Mark' | 'Line' | 'Fill' | 'Text' | 'Raster';
  [key: string]: unknown;
}

/** Metadata for a discovered sample vector dataset. */
export interface SampleDatasetInfo {
  /** Dataset identifier, typically the shapefile basename without extension. */
  id: string;
  /** Human-readable name derived from the directory or file name. */
  name: string;
  /** Geometry type of the dataset. */
  geometryType: 'point' | 'line' | 'polygon';
  /** Coordinate reference system as a PROJ/EPSG string, e.g. "EPSG:4326". */
  crs: string;
  /** Number of features in the dataset. */
  featureCount: number;
  /** Relative path to the dataset directory for debugging. */
  path: string;
}

/** Full payload returned when loading a sample dataset. */
export interface SampleDatasetData {
  id: string;
  name: string;
  geometryType: 'point' | 'line' | 'polygon';
  crs: string;
  featureCount: number;
  /** GeoJSON FeatureCollection in the dataset's source CRS. */
  geojson: GeoJSONFeatureCollection;
  /** Bounding box in the source CRS as [minX, minY, maxX, maxY]. */
  extent: [number, number, number, number];
}

/** A GeoJSON FeatureCollection. */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/** A GeoJSON Feature. */
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

/** Supported GeoJSON geometry types. */
export type GeoJSONGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPoint'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };
