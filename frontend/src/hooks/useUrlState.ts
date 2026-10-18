import { useState, useCallback } from 'react';
import { ImagesQuery } from '../api/types';

export type ViewMode = 'grid' | 'browse';

export interface UrlState extends ImagesQuery {
  file?: string;
  view?: ViewMode;
  browseIndex?: number;
}

export function countActiveFilters(state: UrlState): number {
  let count = 0;
  if (state.recursive) count++;
  if (state.fields && state.fields !== 'name,path') count++;
  if (state.name) count++;
  if (state.pathFilter) count++;
  if (state.prompt) count++;
  if (state.meta) count++;
  if (state.ext) count++;
  if (state.minSize != null && state.minSize > 0) count++;
  if (state.maxSize != null && state.maxSize > 0) count++;
  if (state.fromDate) count++;
  if (state.toDate) count++;
  if (state.aspect) count++;
  if (state.hasPrompt !== undefined) count++;
  return count;
}

export function clearSearchFilters(updateState: (updates: Partial<UrlState>) => void) {
  updateState({
    q: '',
    recursive: undefined,
    fields: undefined,
    name: undefined,
    pathFilter: undefined,
    prompt: undefined,
    meta: undefined,
    ext: undefined,
    minSize: undefined,
    maxSize: undefined,
    fromDate: undefined,
    toDate: undefined,
    aspect: undefined,
    hasPrompt: undefined,
    page: 1,
    browseIndex: 0,
  });
}

export function useUrlState() {
  const [state, setState] = useState<UrlState>(() => {
    const search = new URLSearchParams(window.location.search);
    const viewParam = (search.get('view') as ViewMode) || 'grid';
    const hasPromptParam = search.get('hasPrompt');

    return {
      dir: search.get('dir') || '.',
      recursive: search.get('recursive') === 'true' ? true : undefined,
      q: search.get('q') || '',
      fields: search.get('fields') || undefined,
      name: search.get('name') || undefined,
      pathFilter: search.get('pathFilter') || undefined,
      prompt: search.get('prompt') || undefined,
      meta: search.get('meta') || undefined,
      ext: search.get('ext') || '',
      minSize: search.get('minSize') ? Number(search.get('minSize')) : undefined,
      maxSize: search.get('maxSize') ? Number(search.get('maxSize')) : undefined,
      fromDate: search.get('fromDate') || undefined,
      toDate: search.get('toDate') || undefined,
      aspect: search.get('aspect') || undefined,
      hasPrompt: hasPromptParam !== null ? hasPromptParam === 'true' : undefined,
      sort: (search.get('sort') as UrlState['sort']) || 'name',
      order: (search.get('order') as UrlState['order']) || 'asc',
      page: search.get('page') ? Number(search.get('page')) : 1,
      size: search.get('size') ? Number(search.get('size')) : 60,
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
      if (next.recursive) search.set('recursive', 'true');
      if (next.q) search.set('q', next.q);
      if (next.fields) search.set('fields', next.fields);
      if (next.name) search.set('name', next.name);
      if (next.pathFilter) search.set('pathFilter', next.pathFilter);
      if (next.prompt) search.set('prompt', next.prompt);
      if (next.meta) search.set('meta', next.meta);
      if (next.ext) search.set('ext', next.ext);
      if (next.minSize != null && next.minSize > 0) search.set('minSize', next.minSize.toString());
      if (next.maxSize != null && next.maxSize > 0) search.set('maxSize', next.maxSize.toString());
      if (next.fromDate) search.set('fromDate', next.fromDate);
      if (next.toDate) search.set('toDate', next.toDate);
      if (next.aspect) search.set('aspect', next.aspect);
      if (next.hasPrompt !== undefined) search.set('hasPrompt', next.hasPrompt ? 'true' : 'false');
      if (next.sort && next.sort !== 'name') search.set('sort', next.sort);
      if (next.order && next.order !== 'asc') search.set('order', next.order);
      if (next.page && next.page > 1) search.set('page', next.page.toString());
      if (next.size && next.size !== 60) search.set('size', next.size.toString());
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
