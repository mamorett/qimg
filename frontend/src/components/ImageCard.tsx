import React, { useState } from 'react';
import { Card, Tag, Icon } from '@blueprintjs/core';
import { ImageItem } from '../api/types';

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

  // Helper to split relative path safely for image route
  const thumbUrl = `/img/thumb/${image.path.split('/').map(encodeURIComponent).join('/')}`;

  return (
    <Card interactive onClick={onClick} className="image-card">
      <div className="image-card-thumb-wrapper">
        {hasError ? (
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
      </div>
      <div className="image-card-name" title={image.name}>
        {image.name}
      </div>
      <div className="image-card-tags">
        <Tag minimal style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
          {image.ext.replace('.', '')}
        </Tag>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {formatBytes(image.size)}
        </span>
      </div>
    </Card>
  );
};
