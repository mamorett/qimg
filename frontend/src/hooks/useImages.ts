import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchImages, fetchDirs, fetchMetadata, fetchVersion } from '../api/client';
import { ImagesQuery } from '../api/types';

export function useImages(params: ImagesQuery) {
  const { dir, sort, order, q, ext, page, size } = params;
  const gridParams: ImagesQuery = { dir, sort, order, q, ext, page, size };

  return useQuery({
    queryKey: ['images', gridParams],
    queryFn: () => fetchImages(gridParams),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });
}

export function useDirs(dir: string = '.', recursive: boolean = true) {
  return useQuery({
    queryKey: ['dirs', dir, recursive],
    queryFn: () => fetchDirs(dir, recursive),
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
