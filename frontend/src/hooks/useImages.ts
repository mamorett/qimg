import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchImages, fetchDirs, fetchMetadata, fetchVersion, deleteImage, fetchBuckets, fetchStorageMode } from '../api/client';
import { ImageItem, ImagesQuery, ImagesResponse } from '../api/types';

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

export function useStorageMode() {
  return useQuery({
    queryKey: ['storageMode'],
    queryFn: () => fetchStorageMode(),
    staleTime: Infinity,
  });
}

export function useBuckets() {
  return useQuery({
    queryKey: ['buckets'],
    queryFn: () => fetchBuckets(),
    staleTime: 60000,
  });
}

export function useDeleteImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => deleteImage(path),
    onSuccess: (_, deletedPath) => {
      qc.setQueriesData(
        { queryKey: ['images'] },
        (oldData: any) => {
          if (!oldData) return oldData;
          if (oldData.pages && Array.isArray(oldData.pages)) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: ImagesResponse) => ({
                ...page,
                items: page.items.filter((item: ImageItem) => item.path !== deletedPath),
                total: Math.max(0, page.total - 1),
              })),
            };
          }
          if (Array.isArray(oldData.items)) {
            return {
              ...oldData,
              items: oldData.items.filter((item: ImageItem) => item.path !== deletedPath),
              total: Math.max(0, oldData.total - 1),
            };
          }
          return oldData;
        }
      );
      qc.removeQueries({ queryKey: ['metadata', deletedPath] });
      qc.invalidateQueries({ queryKey: ['images'] });
      qc.invalidateQueries({ queryKey: ['dirs'] });
    },
  });
}


