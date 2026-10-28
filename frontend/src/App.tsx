import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Intent } from '@blueprintjs/core';
import { useUrlState } from './hooks/useUrlState';
import { AppNavbar } from './components/AppNavbar';
import { Sidebar } from './components/Sidebar';
import { ImageGrid } from './components/ImageGrid';
import { BrowseView } from './components/BrowseView';
import { DetailDialog } from './components/DetailDialog';
import { AboutDialog } from './components/AboutDialog';
import { AdvancedSearchPanel } from './components/AdvancedSearchPanel';
import { showToaster } from './components/Toast';

const queryClient = new QueryClient();

function MainApp() {
  const { state, updateState } = useUrlState();
  const qc = useQueryClient();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const savedScrollTopRef = useRef<number>(0);

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

  const handleRefresh = async () => {
    setRefreshId((prev) => prev + 1);
    await qc.resetQueries({ queryKey: ['images'] });
    await qc.refetchQueries({ queryKey: ['images'] });
    await qc.refetchQueries({ queryKey: ['dirs'] });
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

  const isBrowse = state.view === 'browse';

  const restoreScrollPosition = useCallback(() => {
    if (isBrowse) return;
    const targetTop = savedScrollTopRef.current;
    const apply = () => {
      if (mainRef.current && Math.abs(mainRef.current.scrollTop - targetTop) > 1) {
        mainRef.current.scrollTop = targetTop;
      }
    };
    apply();
    requestAnimationFrame(apply);
  }, [isBrowse]);

  useLayoutEffect(() => {
    restoreScrollPosition();
  }, [state.file, restoreScrollPosition]);

  useEffect(() => {
    savedScrollTopRef.current = 0;
  }, [
    state.dir,
    state.q,
    state.sort,
    state.order,
    state.size,
    state.ext,
    state.recursive,
    state.prompt,
    state.meta,
    state.pathFilter,
    state.name,
    state.fields,
    state.aspect,
    state.hasPrompt,
    state.minSize,
    state.maxSize,
    state.fromDate,
    state.toDate,
  ]);

  const handleMainScroll = useCallback(() => {
    if (!state.file && !isBrowse && mainRef.current) {
      savedScrollTopRef.current = mainRef.current.scrollTop;
    }
  }, [state.file, isBrowse]);

  const handleSelectImage = useCallback(
    (path: string) => {
      if (mainRef.current && !isBrowse) {
        savedScrollTopRef.current = mainRef.current.scrollTop;
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      updateState({ file: path });
    },
    [isBrowse, updateState]
  );

  const handleCloseDetail = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    updateState({ file: undefined });
    restoreScrollPosition();
  }, [updateState, restoreScrollPosition]);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        view={isBrowse ? 'browse' : 'grid'}
        onViewChange={(v) => updateState({ view: v, browseIndex: v === 'browse' ? 0 : state.browseIndex })}
        isAdvancedOpen={isAdvancedOpen}
        onToggleAdvanced={() => setIsAdvancedOpen((prev) => !prev)}
      />

      <div className="app-layout">
        <Sidebar state={state} updateState={updateState} />
        <main
          ref={mainRef}
          onScroll={handleMainScroll}
          className={`main-content${isBrowse ? ' main-content--browse' : ''}`}
        >
          <AdvancedSearchPanel
            state={state}
            updateState={updateState}
            isOpen={isAdvancedOpen}
            onToggle={() => setIsAdvancedOpen((prev) => !prev)}
          />
          {isBrowse ? (
            <BrowseView state={state} updateState={updateState} />
          ) : (
            <ImageGrid
              state={state}
              updateState={updateState}
              onSelectImage={handleSelectImage}
              refreshId={refreshId}
            />
          )}
        </main>
      </div>

      <DetailDialog
        filePath={state.file || null}
        onClose={handleCloseDetail}
        onClosed={restoreScrollPosition}
      />

      <AboutDialog
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
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

