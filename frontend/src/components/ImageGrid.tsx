import React, { useEffect, useRef } from 'react';
import { Spinner, NonIdealState, Button } from '@blueprintjs/core';
import { useImages } from '../hooks/useImages';
import { UrlState } from '../hooks/useUrlState';
import { ImageCard } from './ImageCard';

interface ImageGridProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
  onSelectImage: (path: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ state, updateState, onSelectImage }) => {
  const { data, isLoading, isError, error, refetch } = useImages(state);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const mainEl = containerRef.current?.closest('.main-content') || document.querySelector('.main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [state.page, state.dir, state.q, state.sort, state.order, state.size, state.ext]);

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

  if (!data || data.total === 0) {
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

  const totalPages = Math.ceil(data.total / data.size);
  const currentPage = data.page;

  return (
    <div ref={containerRef}>
      <div className="image-grid">
        {data.items.map((img) => (
          <ImageCard
            key={img.path}
            image={img}
            onClick={() => onSelectImage(img.path)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination-bar">
          <Button
            minimal
            icon="chevron-left"
            disabled={currentPage <= 1}
            onClick={() => updateState({ page: currentPage - 1 })}
          >
            Previous
          </Button>

          <span className="pagination-text">
            Page {currentPage} of {totalPages} ({data.total} total)
          </span>

          <Button
            minimal
            rightIcon="chevron-right"
            disabled={currentPage >= totalPages}
            onClick={() => updateState({ page: currentPage + 1 })}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
