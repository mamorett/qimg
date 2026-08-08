import { Toaster, ToastProps } from '@blueprintjs/core';

let toasterInstance: Toaster | null = null;

export function setToasterRef(ref: Toaster | null) {
  toasterInstance = ref;
}

export function showToaster(props: ToastProps) {
  if (toasterInstance) {
    toasterInstance.show(props);
  }
}
