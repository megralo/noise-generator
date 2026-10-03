import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no PointerEvent: a MouseEvent subclass is enough for the knob drag tests.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

// jsdom has no Blob.text(), which every supported browser provides.
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

afterEach(() => {
  cleanup();
});
