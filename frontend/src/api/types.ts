export interface ImageItem {
  path: string;
  name: string;
  ext: string;
  size: number;
  modTime: string;
  isPng: boolean;
}

export interface ImagesQuery {
  dir?: string;
  sort?: 'name' | 'mtime' | 'size';
  order?: 'asc' | 'desc';
  q?: string;
  ext?: string;
  page?: number;
  size?: number;
}

export interface ImagesResponse {
  dir: string;
  items: ImageItem[];
  total: number;
  page: number;
  size: number;
}

export interface DirItem {
  path: string;
  name: string;
  imageCount: number;
}

export interface DirsResponse {
  dirs: DirItem[];
}

export interface FileDetails {
  path: string;
  name: string;
  ext: string;
  size: number;
  modTime: string;
  width: number;
  height: number;
  aspectRatio: string;
}

export interface PromptDTO {
  text: string;
  nodeId: string;
  nodeType: string;
  title: string;
  source: string;
}

export interface PNGMetadata {
  chunks: Record<string, string>;
  extractionMethod: string;
  prompts: PromptDTO[];
  extractionError?: string;
}

export interface MetadataResponse {
  file: FileDetails;
  png: PNGMetadata | null;
}

export interface VersionInfo {
  name: string;
  version: string;
}
