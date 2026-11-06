import { describe, expect, it } from 'vitest';
import { allowlistEntryOf, extensionOf, isRasterImage } from './allowlist.js';

describe('allowlist (§13.3)', () => {
  it.each([
    ['screenshot.png', { kind: 'binary', format: 'png', contentType: 'image/png' }],
    ['photo.JPG', { kind: 'binary', format: 'jpg', contentType: 'image/jpeg' }],
    ['photo.jpeg', { kind: 'binary', format: 'jpg', contentType: 'image/jpeg' }],
    ['scan.pdf', { kind: 'binary', format: 'pdf', contentType: 'application/pdf' }],
    ['notes.txt', { kind: 'text', isJson: false, contentType: 'text/plain; charset=utf-8' }],
    ['server.log', { kind: 'text', isJson: false, contentType: 'text/plain; charset=utf-8' }],
    ['export.csv', { kind: 'text', isJson: false, contentType: 'text/csv; charset=utf-8' }],
    ['data.json', { kind: 'text', isJson: true, contentType: 'application/json' }],
    ['archive.tar.zip', { kind: 'binary', format: 'zip', contentType: 'application/zip' }],
    [
      'report.docx',
      {
        kind: 'binary',
        format: 'docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
    ['sheet.ods', expect.objectContaining({ format: 'ods' })],
  ])('allows %s as %o', (fileName, entry) => {
    expect(allowlistEntryOf(fileName)).toEqual(entry);
  });

  it.each(['image.svg', 'page.html', 'run.exe', 'README', '.png', 'constructor', 'x.toString'])(
    'refuses %s',
    (fileName) => {
      expect(allowlistEntryOf(fileName)).toBeUndefined();
    },
  );

  it.each([
    ['a.B.Png', 'png'],
    ['no-extension', undefined],
    ['.hidden', undefined],
    ['trailing.', ''],
  ])('reads the extension of %s as %s', (fileName, extension) => {
    expect(extensionOf(fileName)).toBe(extension);
  });

  it.each([
    ['image/png', true],
    ['image/jpeg', true],
    ['image/gif', true],
    ['image/webp', true],
    ['application/pdf', false],
    ['text/plain; charset=utf-8', false],
  ])('shows %s inline: %s', (contentType, isImage) => {
    expect(isRasterImage(contentType)).toBe(isImage);
  });
});
