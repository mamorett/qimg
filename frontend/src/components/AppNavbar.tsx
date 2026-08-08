import React from 'react';
import { Navbar, NavbarGroup, Alignment, Button, Classes, MenuItem } from '@blueprintjs/core';
import { Select } from '@blueprintjs/select';
import { useDirs } from '../hooks/useImages';

interface AppNavbarProps {
  currentDir: string;
  onSelectDir: (dir: string) => void;
  onRefresh: () => void;
  onOpenAbout: () => void;
  theme: 'editorial' | 'dark-nord';
  onToggleTheme: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  currentDir,
  onSelectDir,
  onRefresh,
  onOpenAbout,
  theme,
  onToggleTheme,
}) => {
  const { data: dirsData } = useDirs(currentDir);
  const dirs = dirsData?.dirs || [];

  // Always include root "." and parent ".." option if in a subdirectory
  const allDirItems: { path: string; name: string; count?: number }[] = [
    { path: '.', name: 'Root (.)' },
  ];

  if (currentDir && currentDir !== '.') {
    const parent = currentDir.includes('/')
      ? currentDir.substring(0, currentDir.lastIndexOf('/'))
      : '.';
    allDirItems.push({ path: parent, name: '.. (Parent)' });
  }

  dirs.forEach((d) => {
    allDirItems.push({ path: d.path, name: `${d.name} (${d.imageCount})` });
  });

  const dirSelect = (
    <Select<{ path: string; name: string }>
      items={allDirItems}
      itemRenderer={(item, { handleClick, modifiers }) => {
        if (!modifiers.matchesPredicate) return null;
        return (
          <MenuItem
            key={item.path}
            text={item.name}
            active={item.path === currentDir}
            onClick={handleClick}
          />
        );
      }}
      onItemSelect={(item) => onSelectDir(item.path)}
      popoverProps={{ minimal: true }}
    >
      <Button
        minimal
        small
        text={currentDir === '.' ? 'Root (.)' : currentDir}
        icon="folder-open"
      />
    </Select>
  );

  return (
    <Navbar className={theme === 'dark-nord' ? 'theme-dark-nord' : ''}>
      <NavbarGroup align={Alignment.LEFT}>
        <Navbar.Heading style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '1.4rem' }}>
          qimg
        </Navbar.Heading>
        <Navbar.Divider />
        {dirSelect}
        <Navbar.Divider />
        <Button
          className={Classes.MINIMAL}
          icon="refresh"
          text="Refresh"
          onClick={onRefresh}
        />
        <Button
          className={Classes.MINIMAL}
          icon="help"
          text="About"
          onClick={onOpenAbout}
        />
        <Button
          className={Classes.MINIMAL}
          icon={theme === 'dark-nord' ? 'flash' : 'moon'}
          text={theme === 'dark-nord' ? 'Light Theme' : 'Dark Theme'}
          onClick={onToggleTheme}
        />
      </NavbarGroup>
    </Navbar>
  );
};
