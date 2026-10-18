import React, { useState, useEffect } from 'react';
import {
  Navbar,
  NavbarGroup,
  Alignment,
  Button,
  Classes,
  InputGroup,
  HTMLSelect,
  Popover,
  Slider,
  Tooltip,
  Icon,
  Tag,
  Intent,
  ControlGroup,
} from '@blueprintjs/core';
import { UrlState, ViewMode, countActiveFilters } from '../hooks/useUrlState';
import { useStorageMode, useBuckets } from '../hooks/useImages';

interface AppNavbarProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
  onRefresh: () => void;
  onOpenAbout: () => void;
  theme: 'editorial' | 'dark-nord';
  onToggleTheme: () => void;
  cardSize: number;
  onCardSizeChange: (size: number) => void;
  fitMode: 'contain' | 'cover';
  onToggleFitMode: () => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isAdvancedOpen: boolean;
  onToggleAdvanced: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  state,
  updateState,
  onRefresh,
  onOpenAbout,
  theme,
  onToggleTheme,
  cardSize,
  onCardSizeChange,
  fitMode,
  onToggleFitMode,
  view,
  onViewChange,
  isAdvancedOpen,
  onToggleAdvanced,
}) => {
  const { data: modeData } = useStorageMode();
  const { data: bucketsData } = useBuckets();

  const [localQ, setLocalQ] = useState(state.q || '');

  useEffect(() => {
    setLocalQ(state.q || '');
  }, [state.q]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if ((state.q || '') !== localQ) {
        updateState({ q: localQ, page: 1, browseIndex: 0 });
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [localQ, state.q, updateState]);

  const isS3Mode = modeData?.mode === 's3';
  const showBucketDropdown = isS3Mode && !modeData?.configuredBucket;
  const buckets = bucketsData?.buckets || [];

  const currentBucket = state.dir && state.dir !== '.' ? state.dir.split('/')[0] : '';

  const handleBucketChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedBucket = e.target.value;
    updateState({ dir: selectedBucket ? selectedBucket : '.', page: 1, browseIndex: 0 });
    e.currentTarget.blur();
  };

  const isDeepSearch = state.fields === 'all' || (state.fields && state.fields.includes('prompt') && state.fields.includes('meta'));
  const activeFilters = countActiveFilters(state);

  const toggleDeepSearch = () => {
    if (isDeepSearch) {
      updateState({ fields: undefined, page: 1, browseIndex: 0 });
    } else {
      updateState({ fields: 'all', page: 1, browseIndex: 0 });
    }
  };

  const toggleRecursive = () => {
    updateState({ recursive: state.recursive ? undefined : true, page: 1, browseIndex: 0 });
  };

  const clearSearch = () => {
    setLocalQ('');
    updateState({ q: '', page: 1, browseIndex: 0 });
  };

  return (
    <Navbar className={`app-top-navbar ${theme === 'dark-nord' ? 'theme-dark-nord' : ''}`}>
      <NavbarGroup align={Alignment.LEFT} style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
        <Navbar.Heading style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '1.4rem', margin: 0 }}>
          qimg
        </Navbar.Heading>

        <Navbar.Divider />

        {/* Bucket Dropdown for S3 Mode */}
        {showBucketDropdown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
            <Icon icon="cloud" style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Bucket:</span>
            <HTMLSelect
              minimal
              value={currentBucket}
              onChange={handleBucketChange}
              options={[
                { label: '-- Select Bucket --', value: '' },
                ...buckets.map((b) => ({ label: b, value: b })),
              ]}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
            />
          </div>
        )}

        {showBucketDropdown && <Navbar.Divider />}

        {/* Enhanced Search Input with Quick Toggles */}
        <ControlGroup style={{ alignItems: 'center' }}>
          <InputGroup
            leftIcon="search"
            placeholder={isDeepSearch ? 'Search name, path, prompt, metadata...' : 'Search filename, path...'}
            small
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateState({ q: localQ, page: 1, browseIndex: 0 });
                (e.target as HTMLElement).blur();
              } else if (e.key === 'Escape') {
                (e.target as HTMLElement).blur();
              }
            }}
            rightElement={
              localQ ? (
                <Button
                  icon="cross"
                  minimal
                  small
                  onClick={clearSearch}
                />
              ) : undefined
            }
            style={{ width: isDeepSearch ? '260px' : '200px', transition: 'width 0.2s ease' }}
          />

          <Tooltip content={isDeepSearch ? 'Deep Search active (searches prompts & metadata chunks)' : 'Enable Deep Search (search prompts & metadata chunks)'}>
            <Button
              className={Classes.MINIMAL}
              small
              icon="search-text"
              active={Boolean(isDeepSearch)}
              intent={isDeepSearch ? Intent.PRIMARY : Intent.NONE}
              onClick={toggleDeepSearch}
            />
          </Tooltip>

          <Tooltip content={state.recursive ? 'Searching subfolders recursively' : 'Search current folder only (click to include subfolders)'}>
            <Button
              className={Classes.MINIMAL}
              small
              icon="diagram-tree"
              active={Boolean(state.recursive)}
              intent={state.recursive ? Intent.PRIMARY : Intent.NONE}
              onClick={toggleRecursive}
            />
          </Tooltip>

          <Tooltip content="Open advanced search & filters panel">
            <Button
              className={Classes.MINIMAL}
              small
              icon="filter-list"
              active={isAdvancedOpen || activeFilters > 0}
              onClick={onToggleAdvanced}
              text="Filters"
              rightIcon={
                activeFilters > 0 ? (
                  <Tag round minimal intent={Intent.PRIMARY} style={{ fontSize: '0.65rem', height: '16px', lineHeight: '16px', minWidth: '16px', padding: '0 4px' }}>
                    {activeFilters}
                  </Tag>
                ) : undefined
              }
            />
          </Tooltip>
        </ControlGroup>

        <Navbar.Divider />

        {/* Sort By */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Sort:</span>
          <HTMLSelect
            minimal
            value={state.sort || 'name'}
            onChange={(e) => {
              updateState({ sort: e.target.value as UrlState['sort'], page: 1, browseIndex: 0 });
              e.currentTarget.blur();
            }}
            options={[
              { label: 'Name', value: 'name' },
              { label: 'Path', value: 'path' },
              { label: 'Date', value: 'mtime' },
              { label: 'Size', value: 'size' },
            ]}
          />
        </div>

        {/* Order */}
        <HTMLSelect
          minimal
          value={state.order || 'asc'}
          onChange={(e) => {
            updateState({ order: e.target.value as UrlState['order'], page: 1, browseIndex: 0 });
            e.currentTarget.blur();
          }}
          options={[
            { label: 'Asc ↗', value: 'asc' },
            { label: 'Desc ↘', value: 'desc' },
          ]}
        />
      </NavbarGroup>

      <NavbarGroup align={Alignment.RIGHT} style={{ gap: '0.35rem' }}>
        {/* View Mode Toggle: Grid vs Browse */}
        <Tooltip content={view === 'grid' ? 'Grid view' : 'Switch to Grid view'}>
          <Button
            className={Classes.MINIMAL}
            small
            icon="grid-view"
            active={view === 'grid'}
            onClick={() => onViewChange('grid')}
          />
        </Tooltip>
        <Tooltip content={view === 'browse' ? 'Browse view (one image at a time)' : 'Switch to Browse view'}>
          <Button
            className={Classes.MINIMAL}
            small
            icon="full-circle"
            active={view === 'browse'}
            onClick={() => onViewChange('browse')}
          />
        </Tooltip>

        <Navbar.Divider />

        {/* Fit vs Crop Toggle */}
        <Tooltip content={fitMode === 'contain' ? 'Display full image (no cropping)' : 'Crop image to fill square box'}>
          <Button
            className={Classes.MINIMAL}
            small
            icon={fitMode === 'contain' ? 'maximize' : 'grid'}
            text={fitMode === 'contain' ? 'Fit' : 'Crop'}
            onClick={onToggleFitMode}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
          />
        </Tooltip>

        {/* Thumbnail Size Popover */}
        <Popover
          content={
            <div style={{ padding: '1rem', width: '220px', backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <span>Thumbnail Size</span>
                <b>{cardSize}px</b>
              </div>
              <Slider
                min={120}
                max={360}
                stepSize={10}
                value={cardSize}
                onChange={onCardSizeChange}
                labelRenderer={false}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', gap: '0.5rem' }}>
                <Button small minimal text="S" onClick={() => onCardSizeChange(140)} />
                <Button small minimal text="M" onClick={() => onCardSizeChange(200)} />
                <Button small minimal text="L" onClick={() => onCardSizeChange(300)} />
              </div>
            </div>
          }
          position="bottom"
        >
          <Tooltip content="Adjust thumbnail size">
            <Button
              className={Classes.MINIMAL}
              small
              icon="zoom-in"
              text={`${cardSize}px`}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
            />
          </Tooltip>
        </Popover>

        <Navbar.Divider />

        <Button
          className={Classes.MINIMAL}
          small
          icon="refresh"
          title="Refresh image list"
          onClick={onRefresh}
        />
        <Button
          className={Classes.MINIMAL}
          small
          icon="help"
          title="About qimg"
          onClick={onOpenAbout}
        />
        <Button
          className={Classes.MINIMAL}
          small
          icon={theme === 'dark-nord' ? 'flash' : 'moon'}
          title={theme === 'dark-nord' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          onClick={onToggleTheme}
        />
      </NavbarGroup>
    </Navbar>
  );
};
