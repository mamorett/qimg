import { OverlayToaster, Position, ToastProps, Toaster } from '@blueprintjs/core';

let toasterPromise: Promise<Toaster> | null = null;

function getToaster(): Promise<Toaster> {
  if (!toasterPromise && typeof window !== 'undefined') {
    toasterPromise = OverlayToaster.create({ position: Position.TOP_RIGHT });
  }
  return toasterPromise || Promise.reject(new Error('Window is not defined'));
}

export async function showToaster(props: ToastProps): Promise<string | undefined> {
  try {
    const toaster = await getToaster();
    return toaster.show(props);
  } catch (err) {
    console.error('Failed to show toast notification:', err);
    return undefined;
  }
}
