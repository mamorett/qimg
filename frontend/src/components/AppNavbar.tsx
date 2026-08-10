import React from 'react';
import { Navbar, NavbarGroup, Alignment, Button, Classes, InputGroup, HTMLSelect, Popover, Slider, Tooltip, Icon } from '@blueprintjs/core';
import { UrlState } from '../hooks/useUrlState';
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
}) => {
  const { data: modeData } = useStorageMode();
  const { data: bucketsData } = useBuckets();

  const isS3Mode = modeData?.mode === 's3';
  const showBucketDropdown = isS3Mode && !modeData?.configuredBucket;
  const buckets = bucketsData?.buckets || [];
  
  // Extract current bucket from state.dir if set (e.g., "my-bucket" or "my-bucket/folder")
  const currentBucket = state.dir && state.dir !== '.' ? state.dir.split('/')[0] : '';

  const handleBucketChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedBucket = e.target.value;
    updateState({ dir: selectedBucket ? selectedBucket : '.', page: 1 });
  };

  return (
    <Navbar className={`app-top-navbar ${theme === 'dark-nord' ? 'theme-dark-nord' : ''}`}>
      <NavbarGroup align={Alignment.LEFT} style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
        <Navbar.Heading style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '1.4rem', margin: 0 }}>
          qimg
        </Navbar.Heading>

        <Navbar.Divider />

        {/* Bucket Dropdown for S3 Mode (when S3_BUCKET / -s3-bucket is NOT set) */}
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

        {/* Search Input */}
        <InputGroup
          leftIcon="search"
          placeholder="Search files..."
          small
          value={state.q || ''}
          onChange={(e) => updateState({ q: e.target.value, page: 1 })}
          style={{ width: '180px' }}
        />

        {/* Sort By */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Sort:</span>
          <HTMLSelect
            minimal
            value={state.sort || 'name'}
            onChange={(e) => updateState({ sort: e.target.value as UrlState['sort'], page: 1 })}
            options={[
              { label: 'Name', value: 'name' },
              { label: 'Date', value: 'mtime' },
              { label: 'Size', value: 'size' },
            ]}
          />
        </div>

        {/* Order */}
        <HTMLSelect
          minimal
          value={state.order || 'asc'}
          onChange={(e) => updateState({ order: e.target.value as UrlState['order'], page: 1 })}
          options={[
            { label: 'Asc ↗', value: 'asc' },
            { label: 'Desc ↘', value: 'desc' },
          ]}
        />
      </NavbarGroup>

      <NavbarGroup align={Alignment.RIGHT} style={{ gap: '0.35rem' }}>
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
