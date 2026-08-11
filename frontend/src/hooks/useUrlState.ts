import { useState, useCallback } from 'react';
import { ImagesQuery } from '../api/types';

export type ViewMode = 'grid' | 'browse';

export interface UrlState extends ImagesQuery {
  file?: string;
  view?: ViewMode;
  browseIndex?: number;
}

export function useUrlState() {
  const [state, setState] = useState<UrlState>(() => {
    const search = new URLSearchParams(window.location.search);
    const viewParam = (search.get('view') as ViewMode) || 'grid';
    return {
      dir: search.get('dir') || '.',
      q: search.get('q') || '',
      sort: (search.get('sort') as UrlState['sort']) || 'name',
      order: (search.get('order') as UrlState['order']) || 'asc',
      page: search.get('page') ? Number(search.get('page')) : 1,
      size: search.get('size') ? Number(search.get('size')) : 60,
      ext: search.get('ext') || '',
      file: search.get('file') || undefined,
      view: viewParam === 'browse' ? 'browse' : 'grid',
      browseIndex: search.get('bi') ? Number(search.get('bi')) : 0,
    };
  });

  const updateState = useCallback((updates: Partial<UrlState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      const search = new URLSearchParams();

      if (next.dir && next.dir !== '.') search.set('dir', next.dir);
      if (next.q) search.set('q', next.q);
      if (next.sort && next.sort !== 'name') search.set('sort', next.sort);
      if (next.order && next.order !== 'asc') search.set('order', next.order);
      if (next.page && next.page > 1) search.set('page', next.page.toString());
      if (next.size && next.size !== 60) search.set('size', next.size.toString());
      if (next.ext) search.set('ext', next.ext);
      if (next.file) search.set('file', next.file);
      if (next.view && next.view !== 'grid') search.set('view', next.view);
      if (next.browseIndex && next.browseIndex > 0) search.set('bi', next.browseIndex.toString());

      const newUrl = search.toString() ? `${window.location.pathname}?${search.toString()}` : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return next;
    });
  }, []);

  return { state, updateState };
}
