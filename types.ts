
export interface ImageFile {
  data: string; // base64
  mimeType: string;
  preview: string;
}

export interface Garment {
  id: string;
  name: string;
  category: 'Top' | 'Bottom' | 'Dress' | 'Outerwear' | 'Shoes' | 'Accessory' | 'Companion' | 'Underwear' | 'Traditional';
  imageUrl: string;
}

export interface Background {
  id: string;
  name: string;
  imageUrl: string;
}

export interface TryOnResult {
  id: string;
  imageUrl: string;
  videoUrl?: string;
  garmentId?: string;
  backgroundId?: string;
  customPrompt?: string;
  createdAt: number;
  advice?: string;
}

export enum AppStep {
  UPLOAD_PERSON = 'UPLOAD_PERSON',
  SELECT_GARMENT = 'SELECT_GARMENT',
  SCAN_TAG = 'SCAN_TAG',
  GENERATING = 'GENERATING',
  GENERATING_VIDEO = 'GENERATING_VIDEO',
  RESULT = 'RESULT'
}

export type SelectionMode = 'collection' | 'custom' | 'upload';
