import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchImages, fetchDirs, fetchMetadata, fetchVersion } from '../api/client';
import { ImagesQuery } from '../api/types';

export function useInfiniteImages(params: ImagesQuery) {
  const { dir, sort, order, q, ext, size } = params;
  const gridParams: ImagesQuery = { dir, sort, order, q, ext, size };

  return useInfiniteQuery({
    queryKey: ['images', gridParams],
    queryFn: ({ pageParam = 1 }) => fetchImages({ ...gridParams, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.size);
      if (lastPage.page < totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    staleTime: 30000,
  });
}

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
