import React, { useState } from 'react';
import { Tabs, Tab, Card, Tag, Button, TextArea, NonIdealState, H5, Intent, Collapse } from '@blueprintjs/core';
import { PNGMetadata } from '../api/types';
import { showToaster } from './Toast';

interface PromptPanelProps {
  png: PNGMetadata;
}

export const PromptPanel: React.FC<PromptPanelProps> = ({ png }) => {
  const [selectedTab, setSelectedTab] = useState<'prompts' | 'raw'>('prompts');
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, label: string = 'Prompt') => {
    navigator.clipboard.writeText(text);
    showToaster({
      message: `${label} copied to clipboard`,
      intent: Intent.SUCCESS,
      icon: 'clipboard',
      timeout: 2000,
    });
  };

  const handleCopyAllPrompts = () => {
    const allText = png.prompts.map((p) => p.text).join('\n\n');
    handleCopy(allText, 'All prompts');
  };

  const toggleCollapse = (key: string) => {
    setCollapsedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const promptsTab = (
    <div style={{ paddingTop: '1rem' }}>
      {png.prompts && png.prompts.length > 0 ? (
        <>
          {png.prompts.length > 1 && (
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                minimal
                small
                icon="duplicate"
                text="Copy All Prompts"
                onClick={handleCopyAllPrompts}
              />
            </div>
          )}
          {png.prompts.map((prompt, idx) => (
            <Card key={idx} className="prompt-card">
              <div className="prompt-header">
                <H5 style={{ margin: 0, fontSize: '0.95rem' }}>
                  {prompt.title || prompt.nodeType || `Prompt ${idx + 1}`}
                </H5>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {prompt.source && (
                    <Tag minimal>
                      {prompt.source}
                    </Tag>
                  )}
                  <Button
                    minimal
                    small
                    icon="clipboard"
                    text="Copy"
                    onClick={() => handleCopy(prompt.text)}
                  />
                </div>
              </div>
              <TextArea
                fill
                readOnly
                rows={Math.min(10, Math.max(3, prompt.text.split('\n').length))}
                value={prompt.text}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                }}
              />
            </Card>
          ))}
        </>
      ) : (
        <NonIdealState
          icon="info-sign"
          title="No positive prompts found"
          description={png.extractionError || 'No ComfyUI or A1111 prompts extracted from this PNG.'}
        />
      )}
    </div>
  );

  const chunkKeys = Object.keys(png.chunks || {});

  const rawTab = (
    <div style={{ paddingTop: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Extraction Method:</span>
        <Tag intent="primary" minimal>
          {png.extractionMethod || 'none'}
        </Tag>
      </div>

      {chunkKeys.length > 0 ? (
        chunkKeys.map((key) => {
          const val = png.chunks[key];
          const isCollapsed = Boolean(collapsedKeys[key]);
          return (
            <Card key={key} style={{ marginBottom: '0.75rem', padding: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={() => toggleCollapse(key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Tag intent="success">{key}</Tag>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({val.length} bytes)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Button
                    minimal
                    small
                    icon="clipboard"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(val, `Chunk "${key}"`);
                    }}
                  />
                  <Button
                    minimal
                    small
                    icon={isCollapsed ? 'chevron-down' : 'chevron-up'}
                  />
                </div>
              </div>
              <Collapse isOpen={!isCollapsed}>
                <TextArea
                  fill
                  readOnly
                  rows={Math.min(12, Math.max(3, val.split('\n').length))}
                  value={val}
                  style={{
                    marginTop: '0.5rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </Collapse>
            </Card>
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
  );

  return (
    <Tabs
      id="PromptPanelTabs"
      selectedTabId={selectedTab}
      onChange={(newTab) => setSelectedTab(newTab as 'prompts' | 'raw')}
    >
      <Tab id="prompts" title={`Prompts (${png.prompts?.length || 0})`} panel={promptsTab} />
      <Tab id="raw" title={`Raw Metadata (${chunkKeys.length})`} panel={rawTab} />
    </Tabs>
  );
};
