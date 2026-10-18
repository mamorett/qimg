import React from 'react';
import {
  Collapse,
  Button,
  InputGroup,
  HTMLSelect,
  Switch,
  Tag,
  CompoundTag,
  Intent,
  Classes,
} from '@blueprintjs/core';
import { UrlState, countActiveFilters, clearSearchFilters } from '../hooks/useUrlState';

interface AdvancedSearchPanelProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
  isOpen: boolean;
  onToggle: () => void;
  totalResults?: number;
}

const EXT_OPTIONS = ['png', 'jpg', 'webp', 'gif', 'bmp', 'mp4'];

export const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  state,
  updateState,
  isOpen,
  onToggle,
  totalResults,
}) => {
  const activeCount = countActiveFilters(state);
  const hasActiveFilters = activeCount > 0 || Boolean(state.q);

  const selectedExts = (state.ext || '')
    .split(',')
    .map((e) => e.trim().toLowerCase().replace('.', ''))
    .filter(Boolean);

  const toggleExt = (ext: string) => {
    let newExts: string[];
    if (selectedExts.includes(ext)) {
      newExts = selectedExts.filter((e) => e !== ext);
    } else {
      newExts = [...selectedExts, ext];
    }
    updateState({ ext: newExts.join(','), page: 1, browseIndex: 0 });
  };

  const currentFields = (state.fields || 'name,path').split(',').map((f) => f.trim().toLowerCase());
  const isAllFields = state.fields === 'all' || (currentFields.includes('name') && currentFields.includes('path') && currentFields.includes('prompt') && currentFields.includes('meta'));

  const toggleField = (field: string) => {
    let fields = isAllFields ? ['name', 'path', 'prompt', 'meta'] : [...currentFields];
    if (fields.includes(field)) {
      fields = fields.filter((f) => f !== field);
    } else {
      fields.push(field);
    }
    if (fields.length === 0) {
      fields = ['name'];
    }
    updateState({ fields: fields.join(','), page: 1, browseIndex: 0 });
  };

  // Determine size preset
  const getSizePreset = () => {
    if (state.minSize === 10485760) return 'gt10mb';
    if (state.minSize === 52428800) return 'gt50mb';
    if (state.maxSize === 1048576) return 'lt1mb';
    if (state.minSize === 1048576 && state.maxSize === 10485760) return '1to10mb';
    return '';
  };

  const handleSizePresetChange = (val: string) => {
    switch (val) {
      case 'lt1mb':
        updateState({ minSize: undefined, maxSize: 1048576, page: 1, browseIndex: 0 });
        break;
      case '1to10mb':
        updateState({ minSize: 1048576, maxSize: 10485760, page: 1, browseIndex: 0 });
        break;
      case 'gt10mb':
        updateState({ minSize: 10485760, maxSize: undefined, page: 1, browseIndex: 0 });
        break;
      case 'gt50mb':
        updateState({ minSize: 52428800, maxSize: undefined, page: 1, browseIndex: 0 });
        break;
      default:
        updateState({ minSize: undefined, maxSize: undefined, page: 1, browseIndex: 0 });
        break;
    }
  };

  return (
    <div className="advanced-search-wrapper">
      {/* Active Filter Chips Bar */}
      {hasActiveFilters && (
        <div className="filter-chips-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', flex: 1 }}>
            {totalResults !== undefined && (
              <Tag minimal intent="primary" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                {totalResults} {totalResults === 1 ? 'result' : 'results'}
              </Tag>
            )}

            {state.q && (
              <CompoundTag
                leftContent="Search"
                intent={Intent.PRIMARY}
                onRemove={() => updateState({ q: '', page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.q}
              </CompoundTag>
            )}

            {state.recursive && (
              <CompoundTag
                leftContent="Subfolders"
                intent={Intent.NONE}
                onRemove={() => updateState({ recursive: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                Recursive
              </CompoundTag>
            )}

            {state.fields && (
              <CompoundTag
                leftContent="Scope"
                intent={Intent.NONE}
                onRemove={() => updateState({ fields: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.fields}
              </CompoundTag>
            )}

            {state.prompt && (
              <CompoundTag
                leftContent="Prompt"
                intent={Intent.SUCCESS}
                onRemove={() => updateState({ prompt: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.prompt}
              </CompoundTag>
            )}

            {state.meta && (
              <CompoundTag
                leftContent="Metadata"
                intent={Intent.WARNING}
                onRemove={() => updateState({ meta: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.meta}
              </CompoundTag>
            )}

            {state.name && (
              <CompoundTag
                leftContent="Name"
                intent={Intent.NONE}
                onRemove={() => updateState({ name: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.name}
              </CompoundTag>
            )}

            {state.pathFilter && (
              <CompoundTag
                leftContent="Path"
                intent={Intent.NONE}
                onRemove={() => updateState({ pathFilter: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.pathFilter}
              </CompoundTag>
            )}

            {state.ext && (
              <CompoundTag
                leftContent="Type"
                intent={Intent.NONE}
                onRemove={() => updateState({ ext: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.ext.toUpperCase()}
              </CompoundTag>
            )}

            {state.aspect && (
              <CompoundTag
                leftContent="Aspect"
                intent={Intent.NONE}
                onRemove={() => updateState({ aspect: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.aspect}
              </CompoundTag>
            )}

            {state.hasPrompt !== undefined && (
              <CompoundTag
                leftContent="Has Prompt"
                intent={Intent.NONE}
                onRemove={() => updateState({ hasPrompt: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.hasPrompt ? 'Yes' : 'No'}
              </CompoundTag>
            )}

            {(state.minSize || state.maxSize) && (
              <CompoundTag
                leftContent="Size"
                intent={Intent.NONE}
                onRemove={() => updateState({ minSize: undefined, maxSize: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.minSize ? `>${Math.round(state.minSize / 1048576)}MB ` : ''}
                {state.maxSize ? `<${Math.round(state.maxSize / 1048576)}MB` : ''}
              </CompoundTag>
            )}

            {(state.fromDate || state.toDate) && (
              <CompoundTag
                leftContent="Date"
                intent={Intent.NONE}
                onRemove={() => updateState({ fromDate: undefined, toDate: undefined, page: 1, browseIndex: 0 })}
                style={{ fontSize: '0.75rem' }}
              >
                {state.fromDate || '...'} to {state.toDate || '...'}
              </CompoundTag>
            )}
          </div>

          <Button
            minimal
            small
            icon="reset"
            text="Clear all"
            onClick={() => clearSearchFilters(updateState)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
          />
        </div>
      )}

      {/* Collapsible Advanced Form */}
      <Collapse isOpen={isOpen}>
        <div className="advanced-search-panel">
          <div className="advanced-search-grid">
            {/* Prompt Search */}
            <div>
              <label className="field-label">Positive Prompt Contains</label>
              <InputGroup
                leftIcon="lightbulb"
                placeholder="e.g. cyberpunk, portrait..."
                small
                value={state.prompt || ''}
                onChange={(e) => updateState({ prompt: e.target.value || undefined, page: 1, browseIndex: 0 })}
              />
            </div>

            {/* Metadata / Raw Chunk Search */}
            <div>
              <label className="field-label">Raw Chunk / Metadata Contains</label>
              <InputGroup
                leftIcon="code-block"
                placeholder="e.g. sd_xl_base, euler, lora..."
                small
                value={state.meta || ''}
                onChange={(e) => updateState({ meta: e.target.value || undefined, page: 1, browseIndex: 0 })}
              />
            </div>

            {/* Folder / Path Search */}
            <div>
              <label className="field-label">Subfolder / Path Filter</label>
              <InputGroup
                leftIcon="folder-open"
                placeholder="e.g. outputs/2026..."
                small
                value={state.pathFilter || ''}
                onChange={(e) => updateState({ pathFilter: e.target.value || undefined, page: 1, browseIndex: 0 })}
              />
            </div>

            {/* Filename Search */}
            <div>
              <label className="field-label">Filename Filter</label>
              <InputGroup
                leftIcon="document"
                placeholder="e.g. ComfyUI_0001..."
                small
                value={state.name || ''}
                onChange={(e) => updateState({ name: e.target.value || undefined, page: 1, browseIndex: 0 })}
              />
            </div>

            {/* Media Type Pills */}
            <div>
              <label className="field-label">File Type</label>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {EXT_OPTIONS.map((ext) => {
                  const isSelected = selectedExts.includes(ext);
                  return (
                    <Tag
                      key={ext}
                      interactive
                      minimal={!isSelected}
                      intent={isSelected ? Intent.PRIMARY : Intent.NONE}
                      onClick={() => toggleExt(ext)}
                      style={{ cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.7rem' }}
                    >
                      {ext}
                    </Tag>
                  );
                })}
              </div>
            </div>

            {/* Search Scope Checkboxes for main query */}
            <div>
              <label className="field-label">Search Scope (Main Search Box)</label>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {(['name', 'path', 'prompt', 'meta'] as const).map((field) => {
                  const isChecked = isAllFields || currentFields.includes(field);
                  return (
                    <Tag
                      key={field}
                      interactive
                      minimal={!isChecked}
                      intent={isChecked ? Intent.SUCCESS : Intent.NONE}
                      onClick={() => toggleField(field)}
                      style={{ cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.7rem' }}
                    >
                      {field}
                    </Tag>
                  );
                })}
              </div>
            </div>

            {/* Aspect Ratio Filter */}
            <div>
              <label className="field-label">Aspect Ratio</label>
              <HTMLSelect
                fill
                minimal
                value={state.aspect || ''}
                onChange={(e) => updateState({ aspect: e.target.value || undefined, page: 1, browseIndex: 0 })}
                options={[
                  { label: 'Any Aspect Ratio', value: '' },
                  { label: 'Square (1:1)', value: 'square' },
                  { label: 'Portrait (Height > Width)', value: 'portrait' },
                  { label: 'Landscape (Width > Height)', value: 'landscape' },
                  { label: '16:9 Widescreen', value: '16:9' },
                  { label: '9:16 Vertical', value: '9:16' },
                  { label: '4:3 Standard', value: '4:3' },
                  { label: '3:2 Classic Photo', value: '3:2' },
                ]}
              />
            </div>

            {/* Size Filter */}
            <div>
              <label className="field-label">File Size</label>
              <HTMLSelect
                fill
                minimal
                value={getSizePreset()}
                onChange={(e) => handleSizePresetChange(e.target.value)}
                options={[
                  { label: 'Any Size', value: '' },
                  { label: 'Small (< 1 MB)', value: 'lt1mb' },
                  { label: 'Medium (1 MB – 10 MB)', value: '1to10mb' },
                  { label: 'Large (> 10 MB)', value: 'gt10mb' },
                  { label: 'Huge (> 50 MB)', value: 'gt50mb' },
                ]}
              />
            </div>

            {/* Date Range */}
            <div>
              <label className="field-label">Modified Date Range</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="date"
                  className="bp6-input bp6-small"
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                  value={state.fromDate || ''}
                  onChange={(e) => updateState({ fromDate: e.target.value || undefined, page: 1, browseIndex: 0 })}
                />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <input
                  type="date"
                  className="bp6-input bp6-small"
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                  value={state.toDate || ''}
                  onChange={(e) => updateState({ toDate: e.target.value || undefined, page: 1, browseIndex: 0 })}
                />
              </div>
            </div>

            {/* Switches & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
              <Switch
                className={Classes.SMALL}
                label="Include subfolders recursively"
                checked={Boolean(state.recursive)}
                onChange={(e) => updateState({ recursive: (e.target as HTMLInputElement).checked ? true : undefined, page: 1, browseIndex: 0 })}
                style={{ margin: 0 }}
              />
              <Switch
                className={Classes.SMALL}
                label="Has extracted prompt only"
                checked={Boolean(state.hasPrompt)}
                onChange={(e) => updateState({ hasPrompt: (e.target as HTMLInputElement).checked ? true : undefined, page: 1, browseIndex: 0 })}
                style={{ margin: 0 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
            <Button
              minimal
              small
              icon="reset"
              text="Reset Filters"
              onClick={() => clearSearchFilters(updateState)}
            />
            <Button
              intent={Intent.PRIMARY}
              small
              icon="tick"
              text="Done"
              onClick={onToggle}
            />
          </div>
        </div>
      </Collapse>
    </div>
  );
};
