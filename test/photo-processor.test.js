import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserPhotoProcessor, createPhotoProcessor } from '../src/utils/photoProcessing.js';

test('photo processing uses the replaceable browser processor boundary', () => {
  const processor = createPhotoProcessor('browser');
  assert.equal(processor instanceof BrowserPhotoProcessor, true);
  assert.equal(typeof processor.prepareVariants, 'function');
  assert.throws(() => createPhotoProcessor('server'), /Unsupported photo processor mode/);
});
