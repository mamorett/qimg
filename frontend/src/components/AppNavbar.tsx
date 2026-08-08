import React from 'react';
import { Navbar, NavbarGroup, Alignment, Button, Classes, InputGroup, HTMLSelect, Tag } from '@blueprintjs/core';
import { UrlState } from '../hooks/useUrlState';

interface AppNavbarProps {
  state: UrlState;
  updateState: (updates: Partial<UrlState>) => void;
  onRefresh: () => void;
  onOpenAbout: () => void;
  theme: 'editorial' | 'dark-nord';
  onToggleTheme: () => void;
}

const SUPPORTED_EXTS = ['png', 'jpg', 'gif', 'webp', 'bmp'];

export const AppNavbar: React.FC<AppNavbarProps> = ({
  state,
  updateState,
  onRefresh,
  onOpenAbout,
  theme,
  onToggleTheme,
}) => {
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

  return (
    <Navbar className={`app-top-navbar ${theme === 'dark-nord' ? 'theme-dark-nord' : ''}`}>
      <NavbarGroup align={Alignment.LEFT} style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
        <Navbar.Heading style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '1.4rem', margin: 0 }}>
          qimg
        </Navbar.Heading>

        <Navbar.Divider />

        {/* Search Input */}
        <InputGroup
          leftIcon="search"
          placeholder="Search images..."
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

        {/* Extension filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {SUPPORTED_EXTS.map((ext) => {
            const isActive = activeExts.includes(ext);
            return (
              <Tag
                key={ext}
                interactive
                intent={isActive ? 'primary' : 'none'}
                minimal={!isActive}
                onClick={() => toggleExt(ext)}
                style={{ cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.65rem', padding: '2px 6px' }}
              >
                .{ext}
              </Tag>
            );
          })}
        </div>

        {/* Page Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Per page:</span>
          <HTMLSelect
            minimal
            value={state.size || 60}
            onChange={(e) => updateState({ size: Number(e.target.value), page: 1 })}
            options={[
              { label: '30', value: '30' },
              { label: '60', value: '60' },
              { label: '120', value: '120' },
            ]}
          />
        </div>
      </NavbarGroup>

      <NavbarGroup align={Alignment.RIGHT}>
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
