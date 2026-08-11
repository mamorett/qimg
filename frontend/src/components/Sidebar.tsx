import React, { useState } from 'react';
import { H6, InputGroup, Tag, Icon, Spinner } from '@blueprintjs/core';
import { useDirs } from '../hooks/useImages';
import { UrlState } from '../hooks/useUrlState';

interface SidebarProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, updateState }) => {
  const currentDir = state.dir || '.';
  const { data: dirsData, isLoading, isError } = useDirs('.', true);
  const [filterQuery, setFilterQuery] = useState('');

  const dirs = dirsData?.dirs || [];

  const filteredDirs = dirs.filter((d) => {
    if (!filterQuery.trim()) return true;
    return d.name.toLowerCase().includes(filterQuery.toLowerCase()) || d.path.toLowerCase().includes(filterQuery.toLowerCase());
  });

  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <H6 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Directories
        </H6>
        <Tag minimal style={{ fontSize: '0.7rem' }}>
          {dirs.length}
        </Tag>
      </div>

      <InputGroup
        leftIcon="filter"
        placeholder="Filter folders..."
        small
        value={filterQuery}
        onChange={(e) => setFilterQuery(e.target.value)}
        style={{ marginBottom: '0.75rem' }}
      />

      <div className="dir-tree-list">
        {isLoading && (
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <Spinner size={24} />
          </div>
        )}

        {isError && (
          <div style={{ padding: '0.5rem', color: 'var(--status-error)', fontSize: '0.8rem' }}>
            Failed to load directories.
          </div>
        )}

        {!isLoading && filteredDirs.map((d) => {
          const isActive = currentDir === d.path;
          const depth = d.path === '.' ? 0 : d.path.split('/').length;
          const indent = Math.min(depth * 12, 48);

          return (
            <div
              key={d.path}
              className={`dir-item ${isActive ? 'active' : ''}`}
              style={{ paddingLeft: `${8 + indent}px` }}
              onClick={() => updateState({ dir: d.path, page: 1 })}
            >
              <Icon
                icon={isActive ? 'folder-open' : 'folder-close'}
                size={14}
                style={{
                  marginRight: '6px',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              />
              <span className="dir-item-name" title={d.path}>
                {d.path === '.' ? 'Root (.)' : d.name}
              </span>
              {d.imageCount > 0 && (
                <span className="dir-item-count">
                  {d.imageCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
