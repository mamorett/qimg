import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { OverlayToaster, Intent } from '@blueprintjs/core';
import { useUrlState } from './hooks/useUrlState';
import { AppNavbar } from './components/AppNavbar';
import { Sidebar } from './components/Sidebar';
import { ImageGrid } from './components/ImageGrid';
import { DetailDialog } from './components/DetailDialog';
import { AboutDialog } from './components/AboutDialog';
import { setToasterRef, showToaster } from './components/Toast';

const queryClient = new QueryClient();

function MainApp() {
  const { state, updateState } = useUrlState();
  const qc = useQueryClient();
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const [theme, setTheme] = useState<'editorial' | 'dark-nord'>(() => {
    return (localStorage.getItem('qimg-theme') as 'editorial' | 'dark-nord') || 'editorial';
  });

  const [cardSize, setCardSize] = useState<number>(() => {
    const saved = localStorage.getItem('qimg-card-size');
    return saved ? Number(saved) : 200;
  });

  const [fitMode, setFitMode] = useState<'contain' | 'cover'>(() => {
    const saved = localStorage.getItem('qimg-fit-mode');
    return (saved as 'contain' | 'cover') || 'contain';
  });

  useEffect(() => {
    if (theme === 'dark-nord') {
      document.body.classList.add('theme-dark-nord', 'bp6-dark');
    } else {
      document.body.classList.remove('theme-dark-nord', 'bp6-dark');
    }
    localStorage.setItem('qimg-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--card-min-width', `${cardSize}px`);
    localStorage.setItem('qimg-card-size', cardSize.toString());
  }, [cardSize]);

  useEffect(() => {
    document.documentElement.style.setProperty('--thumb-object-fit', fitMode);
    localStorage.setItem('qimg-fit-mode', fitMode);
  }, [fitMode]);

  const handleRefresh = () => {
    qc.removeQueries({ queryKey: ['images'] });
    qc.invalidateQueries({ queryKey: ['images'] });
    qc.invalidateQueries({ queryKey: ['dirs'] });
    showToaster({
      message: 'Image list refreshed',
      intent: Intent.SUCCESS,
      icon: 'refresh',
      timeout: 2000,
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark-nord' ? 'editorial' : 'dark-nord'));
  };

  const toggleFitMode = () => {
    setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppNavbar
        state={state}
        updateState={updateState}
        onRefresh={handleRefresh}
        onOpenAbout={() => setIsAboutOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        cardSize={cardSize}
        onCardSizeChange={setCardSize}
        fitMode={fitMode}
        onToggleFitMode={toggleFitMode}
      />

      <div className="app-layout">
        <Sidebar state={state} updateState={updateState} />
        <main className="main-content">
          <ImageGrid
            state={state}
            updateState={updateState}
            onSelectImage={(path) => updateState({ file: path })}
          />
        </main>
      </div>

      <DetailDialog
        filePath={state.file || null}
        onClose={() => updateState({ file: undefined })}
      />

      <AboutDialog
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      <OverlayToaster ref={(ref) => setToasterRef(ref)} position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  );
}
