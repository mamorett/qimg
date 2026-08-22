import { Intent } from '@blueprintjs/core';
import { showToaster } from '../components/Toast';

export function fallbackCopy(text: string, onSuccess: () => void, onError: () => void) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      onSuccess();
    } else {
      onError();
    }
  } catch {
    onError();
  }
}

export function copyToClipboard(text: string, label: string = 'text') {
  const onSuccess = () =>
    showToaster({
      message: `Copied ${label} to clipboard`,
      intent: Intent.SUCCESS,
      icon: 'clipboard',
      timeout: 2000,
    });
  const onError = () =>
    showToaster({
      message: 'Failed to copy to clipboard',
      intent: Intent.DANGER,
      icon: 'error',
    });

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard
      .writeText(text)
      .then(onSuccess)
      .catch(() => fallbackCopy(text, onSuccess, onError));
  } else {
    fallbackCopy(text, onSuccess, onError);
  }
}
