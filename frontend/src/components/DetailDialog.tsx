import React, { useState } from 'react';
import { Dialog, Classes, Spinner, NonIdealState, Callout, Button, H5, Tooltip, Tag, Intent, Tabs, Tab, Collapse } from '@blueprintjs/core';
import ReactMarkdown from 'react-markdown';
import { useImageMetadata } from '../hooks/useImages';
import { formatBytes } from './ImageCard';
import { showToaster } from './Toast';

interface DetailDialogProps {
  filePath: string | null;
  onClose: () => void;
}

export const DetailDialog: React.FC<DetailDialogProps> = ({ filePath, onClose }) => {
  const { data, isLoading, isError, error } = useImageMetadata(filePath);
  const [markdownFields, setMarkdownFields] = useState<Record<string, boolean>>({});
  const [collapsedChunks, setCollapsedChunks] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'prompts' | 'raw'>('prompts');

  const isOpen = Boolean(filePath);
  const fileName = filePath ? filePath.split('/').pop() : '';
  const fullImgUrl = filePath ? `/img/full/${filePath.split('/').map(encodeURIComponent).join('/')}` : '';

  const fallbackCopy = (text: string, onSuccess: () => void, onError: () => void) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) onSuccess();
      else onError();
    } catch {
      onError();
    }
  };

  const copyToClipboard = (text: string, label: string = 'text') => {
    const onSuccess = () => showToaster({ message: `Copied ${label} to clipboard`, intent: Intent.SUCCESS, icon: 'clipboard', timeout: 2000 });
    const onError = () => showToaster({ message: 'Failed to copy to clipboard', intent: Intent.DANGER, icon: 'error' });

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess, onError));
    } else {
      fallbackCopy(text, onSuccess, onError);
    }
  };

  const toggleMarkdown = (key: string) => {
    setMarkdownFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isMarkdownEnabled = (key: string) => {
    if (markdownFields[key] === undefined) return true; // Default to markdown enabled
    return markdownFields[key];
  };

  const toggleChunkCollapse = (key: string) => {
    setCollapsedChunks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const chunkKeys = Object.keys(data?.png?.chunks || {});

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={fileName || 'Image Details'}
      icon="media"
      style={{ width: '95%', maxWidth: '1200px', backgroundColor: 'var(--bg-primary)' }}
    >
      <div className={Classes.DIALOG_BODY} style={{ color: 'var(--text-primary)', textAlign: 'left', overflowY: 'auto', maxHeight: '80vh' }}>
        {isLoading && (
          <div style={{ display: 'flex', padding: '4rem', justifyContent: 'center' }}>
            <Spinner size={50} />
          </div>
        )}

        {isError && (
          <NonIdealState
            icon="error"
            title="Failed to load metadata"
            description={(error as Error)?.message || 'An error occurred.'}
          />
        )}

        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left Column: Image Preview & Image Properties */}
            <div style={{ textAlign: 'left' }}>
              <a href={fullImgUrl} target="_blank" rel="noreferrer" title="Click to view full resolution">
                <img
                  src={fullImgUrl}
                  alt={fileName}
                  className="detail-dialog-img"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '450px',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-secondary)',
                  }}
                />
              </a>

              <H5 style={{ color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginTop: '1.5rem', textAlign: 'left' }}>
                Image Properties
              </H5>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '4px' }}>
                {/* Dimensions */}
                <div className="field-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <b style={{ minWidth: '100px', color: 'var(--accent-secondary)' }}>Dimensions:</b>
                  <span style={{ flex: 1, fontFamily: 'var(--font-mono)' }}>
                    {data.file.width > 0 && data.file.height > 0 ? `${data.file.width} × ${data.file.height} px` : 'Unknown'}
                  </span>
                  {data.file.width > 0 && (
                    <Tooltip content="Copy dimensions">
                      <Button
                        icon="clipboard"
                        minimal
                        small
                        onClick={() => copyToClipboard(`${data.file.width}x${data.file.height}`, 'dimensions')}
                      />
                    </Tooltip>
                  )}
                </div>

                {/* Aspect */}
                {data.file.aspectRatio && (
                  <div className="field-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <b style={{ minWidth: '100px', color: 'var(--accent-secondary)' }}>Aspect:</b>
                    <span style={{ flex: 1, fontFamily: 'var(--font-mono)' }}>{data.file.aspectRatio}</span>
                    <Tooltip content="Copy aspect ratio">
                      <Button
                        icon="clipboard"
                        minimal
                        small
                        onClick={() => copyToClipboard(data.file.aspectRatio, 'aspect ratio')}
                      />
                    </Tooltip>
                  </div>
                )}

                {/* Size */}
                <div className="field-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <b style={{ minWidth: '100px', color: 'var(--accent-secondary)' }}>Size:</b>
                  <span style={{ flex: 1, fontFamily: 'var(--font-mono)' }}>{formatBytes(data.file.size)}</span>
                  <Tooltip content="Copy file size">
                    <Button
                      icon="clipboard"
                      minimal
                      small
                      onClick={() => copyToClipboard(formatBytes(data.file.size), 'file size')}
                    />
                  </Tooltip>
                </div>

                {/* Modified */}
                <div className="field-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <b style={{ minWidth: '100px', color: 'var(--accent-secondary)' }}>Modified:</b>
                  <span style={{ flex: 1, fontFamily: 'var(--font-mono)' }}>{new Date(data.file.modTime).toLocaleString()}</span>
                  <Tooltip content="Copy date">
                    <Button
                      icon="clipboard"
                      minimal
                      small
                      onClick={() => copyToClipboard(new Date(data.file.modTime).toLocaleString(), 'date')}
                    />
                  </Tooltip>
                </div>

                {/* Path */}
                <div className="field-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <b style={{ minWidth: '100px', color: 'var(--accent-secondary)' }}>Path:</b>
                  <span className="path-value" style={{ flex: 1, fontFamily: 'var(--font-mono)', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                    {data.file.path}
                  </span>
                  <Tooltip content="Copy path">
                    <Button
                      icon="clipboard"
                      minimal
                      small
                      onClick={() => copyToClipboard(data.file.path, 'path')}
                    />
                  </Tooltip>
                  <Tooltip content="Open original image">
                    <Button
                      icon="download"
                      minimal
                      small
                      style={{ color: 'var(--accent-secondary)' }}
                      onClick={() => window.open(fullImgUrl, '_blank')}
                    />
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Right Column: Metadata & Prompts */}
            <div style={{ overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <H5 style={{ color: 'var(--accent-primary)', margin: 0, textAlign: 'left' }}>
                  Metadata & Prompts
                </H5>
                {data.png && data.png.prompts && data.png.prompts.length > 0 && (
                  <Button
                    minimal
                    small
                    icon="duplicate"
                    text="Copy All Prompts"
                    onClick={() => copyToClipboard(data.png!.prompts.map((p) => p.text).join('\n\n'), 'all prompts')}
                  />
                )}
              </div>

              {data.png ? (
                <Tabs
                  id="DetailMetadataTabs"
                  selectedTabId={activeTab}
                  onChange={(tabId) => setActiveTab(tabId as 'prompts' | 'raw')}
                >
                  <Tab
                    id="prompts"
                    title={`Prompts (${data.png.prompts?.length || 0})`}
                    panel={
                      <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {data.png.prompts && data.png.prompts.length > 0 ? (
                          data.png.prompts.map((prompt, idx) => {
                            const fieldKey = `prompt_${idx}`;
                            const useMarkdown = isMarkdownEnabled(fieldKey);
                            const title = prompt.title || prompt.nodeType || `Prompt #${idx + 1}`;

                            return (
                              <div key={idx} style={{ marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                  <div style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', fontSize: '0.95rem' }}>
                                    {title}
                                  </div>
                                  {prompt.source && <Tag minimal style={{ fontSize: '0.7rem' }}>{prompt.source}</Tag>}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', backgroundColor: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '4px' }}>
                                  <div
                                    className="markdown-field-content"
                                    style={{
                                      color: 'var(--text-primary)',
                                      wordBreak: 'break-word',
                                      flex: 1,
                                      textAlign: 'left',
                                      fontFamily: useMarkdown ? 'var(--font-sans)' : 'var(--font-mono)',
                                      fontSize: '0.95rem',
                                      whiteSpace: useMarkdown ? 'normal' : 'pre-wrap',
                                    }}
                                  >
                                    {useMarkdown ? <ReactMarkdown>{prompt.text}</ReactMarkdown> : prompt.text}
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <Tooltip content={`Copy ${title}`}>
                                      <Button
                                        icon="clipboard"
                                        minimal
                                        small
                                        onClick={() => copyToClipboard(prompt.text, title)}
                                      />
                                    </Tooltip>

                                    <Tooltip content="Toggle markdown rendering">
                                      <Button
                                        icon="code"
                                        minimal
                                        small
                                        intent={useMarkdown ? Intent.PRIMARY : Intent.NONE}
                                        onClick={() => toggleMarkdown(fieldKey)}
                                      />
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <NonIdealState
                            icon="info-sign"
                            title="No positive prompts found"
                            description={data.png.extractionError || 'No ComfyUI or A1111 prompts extracted from this PNG.'}
                          />
                        )}
                      </div>
                    }
                  />

                  <Tab
                    id="raw"
                    title={`Raw Metadata (${chunkKeys.length})`}
                    panel={
                      <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Extraction Method:</span>
                          <Tag intent="primary" minimal>
                            {data.png.extractionMethod || 'none'}
                          </Tag>
                        </div>

                        {chunkKeys.length > 0 ? (
                          chunkKeys.map((key) => {
                            const val = data.png!.chunks[key];
                            const isCollapsed = Boolean(collapsedChunks[key]);
                            const useMarkdown = isMarkdownEnabled(`chunk_${key}`);

                            return (
                              <div key={key} style={{ marginBottom: '0.75rem' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    marginBottom: '0.3rem',
                                  }}
                                  onClick={() => toggleChunkCollapse(key)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Tag intent="success">{key}</Tag>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                      ({val.length} bytes)
                                    </span>
                                  </div>
                                  <Button minimal small icon={isCollapsed ? 'chevron-down' : 'chevron-up'} />
                                </div>

                                <Collapse isOpen={!isCollapsed}>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', backgroundColor: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '4px' }}>
                                    <div
                                      className="markdown-field-content"
                                      style={{
                                        color: 'var(--text-primary)',
                                        wordBreak: 'break-all',
                                        flex: 1,
                                        textAlign: 'left',
                                        fontFamily: useMarkdown ? 'var(--font-sans)' : 'var(--font-mono)',
                                        fontSize: '0.85rem',
                                        whiteSpace: useMarkdown ? 'normal' : 'pre-wrap',
                                      }}
                                    >
                                      {useMarkdown ? <ReactMarkdown>{val}</ReactMarkdown> : val}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <Tooltip content={`Copy chunk ${key}`}>
                                        <Button
                                          icon="clipboard"
                                          minimal
                                          small
                                          onClick={() => copyToClipboard(val, `chunk ${key}`)}
                                        />
                                      </Tooltip>
                                      <Tooltip content="Toggle markdown rendering">
                                        <Button
                                          icon="code"
                                          minimal
                                          small
                                          intent={useMarkdown ? Intent.PRIMARY : Intent.NONE}
                                          onClick={() => toggleMarkdown(`chunk_${key}`)}
                                        />
                                      </Tooltip>
                                    </div>
                                  </div>
                                </Collapse>
                              </div>
                            );
                          })
                        ) : (
                          <NonIdealState
                            icon="document"
                            title="No text chunks found"
                            description="This PNG contains no tEXt/zTXt/iTXt metadata chunks."
                          />
                        )}
                      </div>
                    }
                  />
                </Tabs>
              ) : (
                <Callout intent="none" icon="info-sign" style={{ marginTop: '1rem' }}>
                  Metadata and prompt extraction are available for PNG files only.
                </Callout>
              )}
            </div>
          </div>
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
