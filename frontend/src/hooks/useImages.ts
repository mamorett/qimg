import { useQuery } from '@tanstack/react-query';
import { fetchImages, fetchDirs, fetchMetadata, fetchVersion } from '../api/client';
import { ImagesQuery } from '../api/types';

export function useImages(params: ImagesQuery) {
  return useQuery({
    queryKey: ['images', params],
    queryFn: () => fetchImages(params),
    staleTime: 30000,
  });
}

export function useDirs(dir: string = '.') {
  return useQuery({
    queryKey: ['dirs', dir],
    queryFn: () => fetchDirs(dir),
    staleTime: 30000,
  });
}

export function useImageMetadata(path: string | null) {
  return useQuery({
    queryKey: ['metadata', path],
    queryFn: () => fetchMetadata(path!),
    enabled: Boolean(path),
    staleTime: 30000,
  });
}

export function useVersion() {
  return useQuery({
    queryKey: ['version'],
    queryFn: () => fetchVersion(),
    staleTime: Infinity,
  });
}
