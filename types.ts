

export enum FileType {
  RAW = 'RAW',
  SIMULATION = 'SIMULATION',
}

export interface UploadedFile {
  file: File;
  type: FileType;
  previewUrl?: string;
}

export interface ImageMetadata {
  make: string;
  model: string;
  iso: number;
  exposureTime: number;
  fNumber: number;
  focalLength: number;
  dateTime: string;
}

export interface DevelopSettings {
  exposure: number;   // -3.0 to +3.0
  contrast: number;   // -100 to +100
  temperature: number; // 2000 to 12000 (Kelvin)
  tint: number;       // -50 to +50
  highlights: number; // -100 to +100
  shadows: number;    // -100 to +100
  saturation: number; // -100 to +100
  grainAmount: number; // 0 to 100 (New)
  sharpness: number;   // 0 to 100 (New)
}

export interface SimulationAnalysis {
  name: string;
  description: string;
  mood: string[];
  suggestedSettings?: Partial<DevelopSettings>;
}

export enum ProcessingState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READING_FILES = 'READING_FILES',
  PARSING_LUT = 'PARSING_LUT',
  EXTRACTING_JPEG = 'EXTRACTING_JPEG',
  EXTRACTING_METADATA = 'EXTRACTING_METADATA',
  CONVERTING_FLOAT = 'CONVERTING_FLOAT',
  PROCESSING_PIPELINE = 'PROCESSING_PIPELINE',
  APPLYING_LUT = 'APPLYING_LUT',
  WRITING_DNG = 'WRITING_DNG',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface LutData {
  title: string;
  size: number;
  domainMin: number[];
  domainMax: number[];
  data: Float32Array; // RGBRGB...
}

export interface FloatImage {
  width: number;
  height: number;
  data: Float32Array; // RGB (no alpha for internal processing to save memory, or RGBA)
  channels: number; // 3 or 4
}

export const DEFAULT_SETTINGS: DevelopSettings = {
  exposure: 0,
  contrast: 0,
  temperature: 6500,
  tint: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  grainAmount: 0,
  sharpness: 0,
};

// --- RECIPE TYPES ---

export interface FilmRecipe {
  id: string;
  name: string;
  iso: string;
  usedFor: string;
  characteristics: string;
  category: string[];
  tags: string[];
  settings: {
    filmSimulation: string;
    dynamicRange: string;
    whiteBalance: number;
    tintShift: number; // mapped to Tint
    wbShiftR: number; // informational
    wbShiftB: number; // informational
    colorChrome: string;
    colorChromeBlue: string;
    highlights: number;
    shadows: number;
    noiseReduction: number;
    sharpness: number;
    colorSaturation: number;
    grainEffect: string;
    clarity?: number; // Added clarity support
  };
}

export interface RecipePack {
  id: string;
  name: string;
  author: string;
  recipes: FilmRecipe[];
}

// --- CAMERA PROFILE TYPES ---

export interface CameraModel {
  name: string;
  deviceId: string;
  versionCode: string; // e.g., X-T5_0100
  defaultSerial?: string;
}

export interface Fp1ExportOptions {
  cameraModel: CameraModel;
  label?: string; // The internal label shown in camera menu
  customSerial?: string;
}