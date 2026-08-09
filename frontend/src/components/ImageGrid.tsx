import React, { useEffect, useRef } from 'react';
import { Spinner, NonIdealState, Button } from '@blueprintjs/core';
import { useInfiniteImages } from '../hooks/useImages';
import { UrlState } from '../hooks/useUrlState';
import { ImageCard } from './ImageCard';

interface ImageGridProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
  onSelectImage: (path: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ state, updateState, onSelectImage }) => {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteImages(state);

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);

  // Scroll to top when directory or search filters change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const mainEl = containerRef.current?.closest('.main-content') || document.querySelector('.main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [state.dir, state.q, state.sort, state.order, state.size, state.ext]);

  // IntersectionObserver for continuous scroll
  useEffect(() => {
    const sentinelEl = sentinelRef.current;
    if (!sentinelEl) return;

    const mainEl = containerRef.current?.closest('.main-content') || document.querySelector('.main-content');

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: mainEl,
        rootMargin: '300px',
      }
    );

    observer.observe(sentinelEl);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={50} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '4rem 2rem' }}>
        <NonIdealState
          icon="error"
          title="Failed to load images"
          description={(error as Error)?.message || 'An error occurred while fetching the image list.'}
          action={<Button icon="refresh" intent="primary" onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  const items = data ? data.pages.flatMap((page) => page.items) : [];
  const total = data?.pages[0]?.total ?? 0;

  if (items.length === 0) {
    return (
      <div style={{ padding: '4rem 2rem' }}>
        <NonIdealState
          icon="media"
          title="No images found"
          description="Try selecting a different directory or adjusting your search filters."
          action={
            state.q || state.ext ? (
              <Button icon="reset" onClick={() => updateState({ q: '', ext: '', page: 1 })}>
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <div className="image-grid">
        {items.map((img, idx) => (
          <ImageCard
            key={`${img.path}-${idx}`}
            image={img}
            onClick={() => onSelectImage(img.path)}
          />
        ))}
      </div>

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} style={{ height: '20px', marginTop: '1.5rem' }} />

      {/* Loading indicator or status message */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        {isFetchingNextPage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Spinner size={24} />
            <span>Loading more images...</span>
          </div>
        ) : hasNextPage ? (
          <Button minimal onClick={() => fetchNextPage()}>
            Load More ({items.length} of {total})
          </Button>
        ) : (
          <span>Showing all {total} images</span>
        )}
      </div>
    </div>
  );
};
