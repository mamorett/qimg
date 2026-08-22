import React, { useState } from 'react';
import { Card, Tag, Icon, Button, Tooltip, Intent, Alert } from '@blueprintjs/core';
import { useQueryClient } from '@tanstack/react-query';
import { ImageItem } from '../api/types';
import { fetchMetadata } from '../api/client';
import { useDeleteImage } from '../hooks/useImages';
import { showToaster } from './Toast';
import { copyToClipboard } from '../utils/clipboard';

interface ImageCardProps {
  image: ImageItem;
  onClick: () => void;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, onClick }) => {
  const [hasError, setHasError] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const qc = useQueryClient();
  const deleteMutation = useDeleteImage();

  const isVideo = image.ext.toLowerCase() === '.mp4';
  const fullUrl = `/img/full/${image.path.split('/').map(encodeURIComponent).join('/')}`;
  const thumbUrl = `/img/thumb/${image.path.split('/').map(encodeURIComponent).join('/')}`;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!image.isPng) {
      showToaster({
        message: 'Prompt extraction is only available for PNG images',
        intent: Intent.WARNING,
        icon: 'warning-sign',
        timeout: 2500,
      });
      return;
    }

    setIsCopying(true);
    try {
      const meta = await qc.ensureQueryData({
        queryKey: ['metadata', image.path],
        queryFn: () => fetchMetadata(image.path),
        staleTime: 30000,
      });

      const firstPrompt = meta.png?.prompts?.[0]?.text;
      if (firstPrompt && firstPrompt.trim()) {
        copyToClipboard(firstPrompt.trim(), `prompt`);
      } else {
        showToaster({
          message: meta.png?.extractionError || 'No prompts found in image',
          intent: Intent.WARNING,
          icon: 'warning-sign',
          timeout: 2500,
        });
      }
    } catch (err: any) {
      showToaster({
        message: err?.message || 'Failed to extract prompt',
        intent: Intent.DANGER,
        icon: 'error',
        timeout: 2500,
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(image.path, {
      onSuccess: () => {
        setIsDeleteConfirmOpen(false);
        showToaster({
          message: `File "${image.name}" deleted`,
          intent: Intent.DANGER,
          icon: 'trash',
          timeout: 3000,
        });
      },
      onError: (err: any) => {
        setIsDeleteConfirmOpen(false);
        showToaster({
          message: err?.message || `Failed to delete file "${image.name}"`,
          intent: Intent.DANGER,
          icon: 'error',
        });
      },
    });
  };

  return (
    <>
      <Card interactive onClick={onClick} className="image-card">
        <div className="image-card-thumb-wrapper" style={{ position: 'relative' }}>
          {isVideo ? (
            <video
              className="image-card-thumb"
              src={fullUrl}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
            />
          ) : hasError ? (
            <Icon icon="media" size={32} style={{ color: 'var(--text-muted)' }} />
          ) : (
            <img
              className="image-card-thumb"
              src={thumbUrl}
              alt={image.name}
              loading="lazy"
              onError={() => setHasError(true)}
            />
          )}

          {isVideo && (
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                right: '6px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Icon icon="video" size={12} style={{ color: '#fff' }} />
              MP4
            </div>
          )}
        </div>

        <div className="image-card-name" title={image.name}>
          {image.name}
        </div>

        <div
          className="image-card-tags"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '24px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Tag minimal style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
              {image.ext.replace('.', '')}
            </Tag>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {formatBytes(image.size)}
            </span>
          </div>

          <div
            className="image-card-actions"
            style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip content={image.isPng ? 'Copy prompt (first prompt)' : 'Copy prompt (PNG only)'}>
              <Button
                minimal
                small
                icon="clipboard"
                loading={isCopying}
                onClick={handleCopyPrompt}
                style={{ padding: '0 4px', minHeight: '22px' }}
              />
            </Tooltip>
            <Tooltip content={`Download ${image.name}`}>
              <Button
                minimal
                small
                icon="download"
                onClick={handleDownload}
                style={{ padding: '0 4px', minHeight: '22px' }}
              />
            </Tooltip>
            <Tooltip content={`Delete ${image.name}`}>
              <Button
                minimal
                small
                icon="trash"
                intent={Intent.DANGER}
                onClick={handleDeleteClick}
                style={{ padding: '0 4px', minHeight: '22px' }}
              />
            </Tooltip>
          </div>
        </div>
      </Card>

      {isDeleteConfirmOpen && (
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
          <p>
            Are you sure you want to delete <strong>{image.name}</strong>?
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This action cannot be undone.</p>
        </Alert>
      )}
    </>
  );
};

