import React from 'react';
import { Dialog, Classes, Spinner, NonIdealState, Callout, Button } from '@blueprintjs/core';
import { useImageMetadata } from '../hooks/useImages';
import { formatBytes } from './ImageCard';
import { PromptPanel } from './PromptPanel';

interface DetailDialogProps {
  filePath: string | null;
  onClose: () => void;
}

export const DetailDialog: React.FC<DetailDialogProps> = ({ filePath, onClose }) => {
  const { data, isLoading, isError, error } = useImageMetadata(filePath);

  const isOpen = Boolean(filePath);
  const fileName = filePath ? filePath.split('/').pop() : '';
  const fullImgUrl = filePath ? `/img/full/${filePath.split('/').map(encodeURIComponent).join('/')}` : '';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={fileName || 'Image Details'}
      icon="media"
      style={{ width: '90%', maxWidth: '920px', maxHeight: '90vh' }}
    >
      <div className={Classes.DIALOG_BODY} style={{ overflowY: 'auto' }}>
        {filePath && (
          <img
            className="detail-dialog-img"
            src={fullImgUrl}
            alt={fileName}
          />
        )}

        {isLoading && (
          <div style={{ display: 'flex', padding: '2rem', justifyContent: 'center' }}>
            <Spinner size={40} />
          </div>
        )}

        {isError && (
          <NonIdealState
            icon="error"
            title="Failed to load metadata"
            description={(error as Error)?.message}
          />
        )}

        {data && (
          <>
            <div className="field-row">
              <div className="field-item">
                <span className="field-label">Dimensions</span>
                <span className="field-value">
                  {data.file.width > 0 && data.file.height > 0
                    ? `${data.file.width} × ${data.file.height}${data.file.aspectRatio ? ` · ${data.file.aspectRatio}` : ''}`
                    : 'Unknown'}
                </span>
              </div>

              <div className="field-item">
                <span className="field-label">Size</span>
                <span className="field-value">{formatBytes(data.file.size)}</span>
              </div>

              <div className="field-item">
                <span className="field-label">Modified</span>
                <span className="field-value">
                  {new Date(data.file.modTime).toLocaleString()}
                </span>
              </div>

              <div className="field-item" style={{ flex: 1, minWidth: '200px' }}>
                <span className="field-label">Path</span>
                <span className="field-value path-value">{data.file.path}</span>
              </div>
            </div>

            {data.png ? (
              <PromptPanel png={data.png} />
            ) : (
              <Callout intent="none" icon="info-sign" style={{ marginTop: '1rem' }}>
                Metadata and prompt extraction are available for PNG files only.
              </Callout>
            )}
          </>
        )}
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
};
