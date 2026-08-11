import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Classes,
  Tooltip,
  Tag,
  Intent,
  Alert,
  Spinner,
  NonIdealState,
  Alignment,
  Navbar,
  NavbarGroup,
  NavbarDivider,
} from '@blueprintjs/core';
import { useInfiniteImages, useDeleteImage } from '../hooks/useImages';
import { UrlState } from '../hooks/useUrlState';
import { showToaster } from './Toast';

interface BrowseViewProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
}

export const BrowseView: React.FC<BrowseViewProps> = ({ state, updateState }) => {
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

  const deleteMutation = useDeleteImage();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const items = useMemo(
    () => (data ? data.pages.flatMap((page) => page.items) : []),
    [data],
  );
  const total = data?.pages[0]?.total ?? 0;

  const index = Math.min(Math.max(state.browseIndex ?? 0, 0), Math.max(items.length - 1, 0));
  const current = items[index];

  // Fetch next page proactively when close to the end so navigation stays smooth.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (items.length > 0 && index >= items.length - 3) {
      fetchNextPage();
    }
  }, [index, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Clamp index when items change (e.g., after a delete).
  useEffect(() => {
    if (items.length === 0) return;
    const savedIndex = state.browseIndex ?? 0;
    if (savedIndex !== index) {
      updateState({ browseIndex: index });
    }
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (nextIndex: number) => {
    if (items.length === 0) return;
    const clamped = Math.min(Math.max(nextIndex, 0), items.length - 1);
    updateState({ browseIndex: clamped });
  };

  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);
  const goHome = () => goTo(0);

  const handleDeleteConfirm = () => {
    if (!current) return;
    const targetPath = current.path;
    const targetName = current.name;
    deleteMutation.mutate(targetPath, {
      onSuccess: () => {
        setIsDeleteConfirmOpen(false);
        showToaster({
          message: `File "${targetName}" deleted`,
          intent: Intent.DANGER,
          icon: 'trash',
          timeout: 3000,
        });
        // If we deleted the last item, move back one step.
        if (index >= items.length - 1) {
          goTo(Math.max(0, index - 1));
        }
      },
      onError: (err: any) => {
        setIsDeleteConfirmOpen(false);
        showToaster({
          message: err?.message || `Failed to delete file "${targetName}"`,
          intent: Intent.DANGER,
          icon: 'error',
        });
      },
    });
  };

  // Keyboard navigation. Ignore when typing in inputs/textareas or when an
  // Overlay (Alert / Dialog) is open to avoid hijacking confirmations.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      // Don't intercept while a Blueprint overlay (Alert/Dialog) is visible.
      // Escape inside an overlay should close the overlay itself (Blueprint
      // default) before we fall back to exiting browse mode.
      if (document.querySelector('.bp6-overlay-open')) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case 'Home':
          e.preventDefault();
          goHome();
          break;
        case 'Delete':
          e.preventDefault();
          if (current) setIsDeleteConfirmOpen(true);
          break;
        case 'Escape':
          e.preventDefault();
          updateState({ view: 'grid' });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, items.length, current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter confirms the delete Alert (mirrors clicking the "Delete" button).
  // Escape is already handled by Blueprint's Alert to cancel.
  useEffect(() => {
    if (!isDeleteConfirmOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      if (!deleteMutation.isPending) handleDeleteConfirm();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isDeleteConfirmOpen, deleteMutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = () => {
    if (current) updateState({ file: current.path });
  };

  if (isLoading) {
    return (
      <div className="browse-view">
        <div className="browse-stage browse-stage--loading">
          <Spinner size={50} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="browse-view">
        <div className="browse-stage">
          <NonIdealState
            icon="error"
            title="Failed to load images"
            description={(error as Error)?.message || 'An error occurred while fetching the image list.'}
            action={<Button icon="refresh" intent="primary" onClick={() => refetch()}>Retry</Button>}
          />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="browse-view">
        <div className="browse-stage">
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
      </div>
    );
  }

  const fullUrl = current
    ? `/img/full/${current.path.split('/').map(encodeURIComponent).join('/')}`
    : '';
  const isVideo = current?.ext.toLowerCase() === '.mp4';
  const atStart = index === 0;
  const atEnd = index === items.length - 1 && !hasNextPage;

  return (
    <div className="browse-view">
      <Navbar className="browse-toolbar">
        <NavbarGroup align={Alignment.LEFT} style={{ gap: '0.35rem' }}>
          <Tooltip content="Previous (←)">
            <Button
              className={Classes.MINIMAL}
              icon="chevron-left"
              onClick={goPrev}
              disabled={atStart}
              title="Previous (Arrow Left)"
            />
          </Tooltip>
          <Tooltip content="Next (→)">
            <Button
              className={Classes.MINIMAL}
              icon="chevron-right"
              onClick={goNext}
              disabled={atEnd}
              title="Next (Arrow Right)"
            />
          </Tooltip>
          <Tooltip content="First (Home)">
            <Button
              className={Classes.MINIMAL}
              icon="home"
              onClick={goHome}
              disabled={atStart}
              title="First (Home)"
            />
          </Tooltip>

          <NavbarDivider />

          <Tag minimal className="browse-position-tag">
            {index + 1} / {total}
          </Tag>
          {isFetchingNextPage && <Spinner size={16} />}
        </NavbarGroup>

        <NavbarGroup align={Alignment.RIGHT} style={{ gap: '0.35rem' }}>
          <span className="browse-filename" title={current?.name}>
            {current?.name}
          </span>
          <Tag minimal style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
            {current?.ext.replace('.', '')}
          </Tag>

          <NavbarDivider />

          <Tooltip content="Open details">
            <Button
              className={Classes.MINIMAL}
              icon="info-sign"
              onClick={openDetail}
              title="Open Details"
            />
          </Tooltip>
          <Tooltip content="Download original">
            <Button
              className={Classes.MINIMAL}
              icon="download"
              onClick={() => {
                if (!current) return;
                const link = document.createElement('a');
                link.href = fullUrl;
                link.download = current.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              title="Download"
            />
          </Tooltip>
          <Tooltip content="Delete (Del)">
            <Button
              className={Classes.MINIMAL}
              icon="trash"
              intent={Intent.DANGER}
              onClick={() => setIsDeleteConfirmOpen(true)}
              title="Delete (Delete)"
            />
          </Tooltip>
        </NavbarGroup>
      </Navbar>

      <div className="browse-stage">
        {isVideo ? (
          <video
            key={current?.path}
            src={fullUrl}
            controls
            autoPlay
            loop
            className="browse-media"
          />
        ) : (
          <img
            key={current?.path}
            src={fullUrl}
            alt={current?.name}
            className="browse-media"
          />
        )}
      </div>

      <Alert
        isOpen={isDeleteConfirmOpen}
        cancelButtonText="Cancel"
        confirmButtonText="Delete"
        icon="trash"
        intent={Intent.DANGER}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
      >
        <p>Are you sure you want to delete <strong>{current?.name}</strong>?</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This action cannot be undone.</p>
      </Alert>
    </div>
  );
};
