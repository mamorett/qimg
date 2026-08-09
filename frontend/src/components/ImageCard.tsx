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

  const isVideo = image.ext.toLowerCase() === '.mp4';
  const fullUrl = `/img/full/${image.path.split('/').map(encodeURIComponent).join('/')}`;
  const thumbUrl = `/img/thumb/${image.path.split('/').map(encodeURIComponent).join('/')}`;

  return (
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
