import React from 'react';
import { H6, InputGroup, HTMLSelect, FormGroup, Tag, Button, Classes } from '@blueprintjs/core';
import { UrlState } from '../hooks/useUrlState';

interface SidebarProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
}

const SUPPORTED_EXTS = ['png', 'jpg', 'gif', 'webp', 'bmp'];

export const Sidebar: React.FC<SidebarProps> = ({ state, updateState }) => {
  const activeExts = state.ext ? state.ext.split(',').map((e) => e.trim().toLowerCase()) : [];

  const toggleExt = (ext: string) => {
    let nextExts: string[];
    if (activeExts.includes(ext)) {
      nextExts = activeExts.filter((e) => e !== ext);
    } else {
      nextExts = [...activeExts, ext];
    }
    updateState({ ext: nextExts.join(','), page: 1 });
  };

  const handleReset = () => {
    updateState({
      q: '',
      sort: 'name',
      order: 'asc',
      ext: '',
      page: 1,
      size: 60,
    });
  };

  return (
    <aside className="sidebar">
      <div>
        <H6 style={{ marginBottom: '0.5rem' }}>Search</H6>
        <InputGroup
          leftIcon="search"
          placeholder="Filter files..."
          value={state.q || ''}
          onChange={(e) => updateState({ q: e.target.value, page: 1 })}
        />
      </div>

      <FormGroup label="Sort By" labelFor="sort-select">
        <HTMLSelect
          id="sort-select"
          fill
          value={state.sort || 'name'}
          onChange={(e) => updateState({ sort: e.target.value as UrlState['sort'], page: 1 })}
          options={[
            { label: 'File Name', value: 'name' },
            { label: 'Date Modified', value: 'mtime' },
            { label: 'File Size', value: 'size' },
          ]}
        />
      </FormGroup>

      <FormGroup label="Order" labelFor="order-select">
        <HTMLSelect
          id="order-select"
          fill
          value={state.order || 'asc'}
          onChange={(e) => updateState({ order: e.target.value as UrlState['order'], page: 1 })}
          options={[
            { label: 'Ascending', value: 'asc' },
            { label: 'Descending', value: 'desc' },
          ]}
        />
      </FormGroup>

      <FormGroup label="Formats">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {SUPPORTED_EXTS.map((ext) => {
            const isActive = activeExts.includes(ext);
            return (
              <Tag
                key={ext}
                interactive
                intent={isActive ? 'primary' : 'none'}
                minimal={!isActive}
                onClick={() => toggleExt(ext)}
                style={{ cursor: 'pointer', textTransform: 'uppercase' }}
              >
                .{ext}
              </Tag>
            );
          })}
        </div>
      </FormGroup>

      <FormGroup label="Page Size" labelFor="size-select">
        <HTMLSelect
          id="size-select"
          fill
          value={state.size || 60}
          onChange={(e) => updateState({ size: Number(e.target.value), page: 1 })}
          options={[
            { label: '30 per page', value: '30' },
            { label: '60 per page', value: '60' },
            { label: '120 per page', value: '120' },
          ]}
        />
      </FormGroup>

      <Button
        className={Classes.MINIMAL}
        icon="reset"
        text="Reset Filters"
        onClick={handleReset}
        style={{ marginTop: 'auto' }}
      />
    </aside>
  );
};
