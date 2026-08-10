import { ImagesQuery, ImagesResponse, DirsResponse, MetadataResponse, VersionInfo } from './types';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // JSON parse error, keep status message
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export async function fetchImages(params: ImagesQuery): Promise<ImagesResponse> {
  const query = new URLSearchParams();
  if (params.dir) query.set('dir', params.dir);
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);
  if (params.q) query.set('q', params.q);
  if (params.ext) query.set('ext', params.ext);
  if (params.page) query.set('page', params.page.toString());
  if (params.size) query.set('size', params.size.toString());

  const res = await fetch(`/api/images?${query.toString()}`);
  return handleResponse<ImagesResponse>(res);
}

export async function fetchDirs(dir: string = '.', recursive: boolean = true): Promise<DirsResponse> {
  const query = new URLSearchParams({ dir, recursive: recursive ? 'true' : 'false' });
  const res = await fetch(`/api/dirs?${query.toString()}`);
  return handleResponse<DirsResponse>(res);
}

export async function fetchMetadata(path: string): Promise<MetadataResponse> {
  const query = new URLSearchParams({ path });
  const res = await fetch(`/api/metadata?${query.toString()}`);
  return handleResponse<MetadataResponse>(res);
}

export async function fetchVersion(): Promise<VersionInfo> {
  const res = await fetch('/api/version');
  return handleResponse<VersionInfo>(res);
}

export async function deleteImage(path: string): Promise<{ success: boolean; path: string }> {
  const query = new URLSearchParams({ path });
  const res = await fetch(`/api/image?${query.toString()}`, {
    method: 'DELETE',
  });
  return handleResponse<{ success: boolean; path: string }>(res);
}

export async function fetchBuckets(): Promise<{ buckets: string[]; active?: string }> {
  const res = await fetch('/api/buckets');
  return handleResponse<{ buckets: string[]; active?: string }>(res);
}

export async function fetchStorageMode(): Promise<{ mode: string; configuredBucket?: string }> {
  const res = await fetch('/api/mode');
  return handleResponse<{ mode: string; configuredBucket?: string }>(res);
}
