import { useState } from 'react';
import { Card, Elevation, H5, Text, Tag, Button, Dialog, Classes, InputGroup, Intent, Tooltip, Alert } from '@blueprintjs/core';
import type { Row, Config } from '../types';
import { Thumbnail } from './Thumbnail';
import { getDownloadUrl, getFileUrl, getFileDownloadUrl } from '../api';
import { formatDate, detectMarkdown } from '../utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useUpdateRow } from '../hooks/useUpdateRow';
import { useDeleteRow } from '../hooks/useDeleteRow';
import { showToaster } from '../App';

export function RowCard({ row, schema, parquetName }: { row: Row; schema: Config; parquetName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [markdownFields, setMarkdownFields] = useState<Record<string, boolean>>({});
  const updateRowMutation = useUpdateRow(parquetName);
  const deleteRowMutation = useDeleteRow(parquetName);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const thumbnailCol = schema.thumbnail.column;

  const fallbackCopyToClipboard = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // Avoid scrolling to bottom
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        showToaster({ message: 'Copied to clipboard', intent: Intent.SUCCESS, icon: 'clipboard' });
      } else {
        showToaster({ message: 'Failed to copy to clipboard', intent: Intent.DANGER, icon: 'error' });
      }
    } catch (err) {
      console.error('Fallback copy failed: ', err);
      showToaster({ message: 'Failed to copy to clipboard', intent: Intent.DANGER, icon: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToaster({ message: 'Copied to clipboard', intent: Intent.SUCCESS, icon: 'clipboard' });
        })
        .catch((err) => {
          console.error('Failed to copy using navigator.clipboard: ', err);
          fallbackCopyToClipboard(text);
        });
    } else {
      fallbackCopyToClipboard(text);
    }
  };

  const toggleMarkdown = (colName: string) =>
    setMarkdownFields(prev => ({ ...prev, [colName]: !prev[colName] }));

  const isMarkdownEnabled = (colName: string, hasMarkdown: boolean) => {
    // If no markdown detected, markdown is never enabled
    if (!hasMarkdown) return false;
    // Default to markdown if detected, unless explicitly toggled off
    if (markdownFields[colName] === undefined) return true;
    return markdownFields[colName];
  };

  const formatValue = (col: any, val: any) => {
    if (val === null || val === undefined) return '';
    if (col.format === 'datetime') return formatDate(val);
    const formattedDate = formatDate(val);
    if (formattedDate !== String(val) && formattedDate !== '') {
      return formattedDate;
    }
    return String(val);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditedValues({ ...row.columns });
  };

  const handleSaveClick = () => {
    updateRowMutation.mutate(
      { index: row.index, columns: editedValues },
      {
        onSuccess: () => {
          setIsEditing(false);
          showToaster({ message: `Row #${row.index} updated`, intent: Intent.SUCCESS, icon: 'saved' });
        },
      }
    );
  };

  const handleDeleteConfirm = () => {
    deleteRowMutation.mutate(
      { index: row.index },
      {
        onSuccess: () => {
          setIsDeleteConfirmOpen(false);
          setIsOpen(false);
          showToaster({ message: `Row #${row.index} deleted`, intent: Intent.DANGER, icon: 'trash' });
        },
        onError: () => {
          setIsDeleteConfirmOpen(false);
          showToaster({ message: `Failed to delete Row #${row.index}`, intent: Intent.DANGER, icon: 'error' });
        },
      }
    );
  };

  const isLargeField = (name: string) =>
    ['image_path', 'prompt', 'description', 'created_at', 'modified_at'].includes(name);

  const isPathColumn = (col: { type: string }) => col.type === 'path';

  const FieldRow = ({ col, value }: { col: any, value: any }) => {
    const isPath = isPathColumn(col);
    return (
      <div className="field-row">
        <b style={{ color: 'var(--accent-secondary)', minWidth: '120px' }}>{col.label}:</b>
        <Tooltip content={`Copy ${col.label}`}>
          <Button
            icon="clipboard"
            minimal
            small
            className="copy-btn"
            onClick={(e) => { e.stopPropagation(); copyToClipboard(formatValue(col, value)); }}
          />
        </Tooltip>
        <span className={`field-value ${isPath ? 'path-value' : ''}`} style={{ flex: 1 }}>{formatValue(col, value)}</span>
        {isPath && (
          <Tooltip content={`Download ${col.label}`}>
            <Button
              icon="download"
              minimal
              small
              style={{ color: 'var(--accent-secondary)', marginLeft: '0.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                window.open(getFileDownloadUrl(row.index, col.name, parquetName), '_blank');
              }}
            />
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <>
      <Card
        interactive
        elevation={Elevation.TWO}
        onClick={() => setIsOpen(true)}
        style={{ padding: '1.25rem', width: '100%' }}
      >
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div style={{ width: '180px', flexShrink: 0 }}>
            <Thumbnail index={row.index} column={thumbnailCol} parquetName={parquetName} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <H5 style={{ color: 'var(--accent-primary)', margin: 0, textAlign: 'left' }}>Row #{row.index}</H5>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Tooltip content="Expand details">
                  <Button icon="maximize" minimal small onClick={(e) => { e.stopPropagation(); setIsOpen(true); }} />
                </Tooltip>
                <Tooltip content="Download row as JSON">
                  <Button icon="download" minimal small onClick={(e) => { e.stopPropagation(); window.open(getDownloadUrl(row.index, parquetName)); }} />
                </Tooltip>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', justifyContent: 'flex-start' }}>
              {row.image_meta && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                    <Tag minimal intent="primary">{row.image_meta.width}x{row.image_meta.height}</Tag>
                    <Tooltip content="Copy dimensions">
                      <Button icon="clipboard" minimal small className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(`${row.image_meta?.width}x${row.image_meta?.height}`); }} />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                    <Tag minimal intent="warning">{row.image_meta.aspect}</Tag>
                    <Tooltip content="Copy aspect ratio">
                      <Button icon="clipboard" minimal small className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(row.image_meta?.aspect || ''); }} />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                    <Tag minimal intent="success">{row.image_meta.file_size_kb.toFixed(1)} KB</Tag>
                    <Tooltip content="Copy file size">
                      <Button icon="clipboard" minimal small className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(row.image_meta?.file_size_kb.toFixed(1) + " KB"); }} />
                    </Tooltip>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {schema.columns.filter(c => !c.hidden).slice(0, 8).map(col => (
                <FieldRow key={col.name} col={col} value={row.columns[col.name]} />
              ))}
              {schema.columns.length > 8 && (
                <Text style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem', textAlign: 'left' }}>+ {schema.columns.length - 8} more fields (click to expand)</Text>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Dialog
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); setIsEditing(false); }}
        title={`Row #${row.index} Details`}
        className="theme-editorial"
        style={{ width: '95%', maxWidth: '1200px', backgroundColor: 'var(--bg-primary)' }}
      >
        <div className={Classes.DIALOG_BODY} style={{ color: 'var(--text-primary)', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={{ textAlign: 'left' }}>
              <a href={getFileUrl(row.index, thumbnailCol, parquetName)} target="_blank" rel="noreferrer">
                <img
                  src={getFileUrl(row.index, thumbnailCol, parquetName)}
                  alt="Full Res"
                  className="detail-dialog-img"
                />
              </a>
              <H5 style={{ color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginTop: '1.5rem', textAlign: 'left' }}>Image Properties</H5>
              {row.image_meta ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '4px' }}>
                  <div className="field-row">
                    <b style={{ minWidth: '100px' }}>Dimensions:</b> {row.image_meta.width} x {row.image_meta.height} px
                    <Tooltip content="Copy dimensions">
                      <Button icon="clipboard" minimal small className="copy-btn" onClick={() => copyToClipboard(`${row.image_meta?.width}x${row.image_meta?.height}`)} />
                    </Tooltip>
                  </div>
                  <div className="field-row">
                    <b style={{ minWidth: '100px' }}>Aspect:</b> {row.image_meta.aspect}
                    <Tooltip content="Copy aspect ratio">
                      <Button icon="clipboard" minimal small className="copy-btn" onClick={() => copyToClipboard(row.image_meta?.aspect || '')} />
                    </Tooltip>
                  </div>
                  <div className="field-row">
                    <b style={{ minWidth: '100px' }}>Size:</b> {row.image_meta.file_size_kb.toFixed(1)} KB
                    <Tooltip content="Copy file size">
                      <Button icon="clipboard" minimal small className="copy-btn" onClick={() => copyToClipboard(row.image_meta?.file_size_kb.toFixed(1) + " KB")} />
                    </Tooltip>
                  </div>
                </div>
              ) : (
                <Text style={{ color: 'var(--text-muted)', textAlign: 'left' }}>No image properties available.</Text>
              )}
            </div>

            <div style={{ overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <H5 style={{ color: 'var(--accent-primary)', margin: 0, textAlign: 'left' }}>Metadata</H5>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!isEditing ? (
                    <>
                      <Button icon="edit" minimal small onClick={handleEditClick}>Edit</Button>
                      <Button icon="trash" minimal small intent={Intent.DANGER} onClick={() => setIsDeleteConfirmOpen(true)}>Delete</Button>
                    </>
                  ) : (
                    <Button icon="cross" minimal small onClick={() => setIsEditing(false)}>Cancel</Button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {schema.columns.map(col => {
                  const isPath = isPathColumn(col);
                  const rawVal = formatValue(col, row.columns[col.name]);
                  const hasMarkdown = !isPath && detectMarkdown(rawVal);
                  const useMarkdown = isMarkdownEnabled(col.name, hasMarkdown);
                  return (
                    <div key={col.name} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', fontSize: isLargeField(col.name) ? '1rem' : '0.85rem', marginBottom: '0.2rem', textAlign: 'left' }}>{col.label}</div>
                      {isEditing && col.editable ? (
                        <InputGroup
                          value={editedValues[col.name] ?? ''}
                          onChange={(e) => setEditedValues({ ...editedValues, [col.name]: e.target.value })}
                          intent={Intent.PRIMARY}
                        />
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '4px' }}>
                          <div className="markdown-field-content" style={{ color: 'var(--text-secondary)', wordBreak: 'break-all', flex: 1, textAlign: 'left', fontFamily: isPath ? 'var(--font-sans)' : 'var(--font-serif)', fontSize: isLargeField(col.name) ? '1rem' : '0.95rem' }}>
                            {useMarkdown ? (
                              <MarkdownRenderer content={rawVal} fontSize={isLargeField(col.name) ? '1rem' : '0.95rem'} />
                            ) : (
                              rawVal
                            )}
                          </div>
                          <Tooltip content={`Copy ${col.label}`}>
                            <Button
                              icon="clipboard"
                              minimal
                              small
                              onClick={() => copyToClipboard(rawVal)}
                            />
                          </Tooltip>
                          {hasMarkdown && (
                            <Tooltip content="Toggle markdown rendering">
                              <Button
                                icon="code"
                                minimal
                                small
                                intent={useMarkdown ? Intent.PRIMARY : Intent.NONE}
                                onClick={() => toggleMarkdown(col.name)}
                              />
                            </Tooltip>
                          )}
                          {isPath && (
                            <Tooltip content={`Download ${col.label}`}>
                              <Button
                                icon="download"
                                minimal
                                small
                                style={{ color: 'var(--accent-secondary)' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(getFileDownloadUrl(row.index, col.name, parquetName), '_blank');
                                }}
                              />
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            {isEditing && (
              <Button
                intent={Intent.SUCCESS}
                onClick={handleSaveClick}
                loading={updateRowMutation.isPending}
              >
                Save Changes
              </Button>
            )}
            <Button onClick={() => { setIsOpen(false); setIsEditing(false); }}>Close</Button>
          </div>
        </div>
      </Dialog>

      <Alert
        isOpen={isDeleteConfirmOpen}
        cancelButtonText="Cancel"
        confirmButtonText="Delete"
        icon="trash"
        intent={Intent.DANGER}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteRowMutation.isPending}
      >
        <p>Are you sure you want to delete <strong>Row #{row.index}</strong>?</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This action cannot be undone.</p>
      </Alert>
    </>
  );
}
