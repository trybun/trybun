import { describe, expect, it } from 'vitest';
import { PdfEncryptionScan } from './pdf-encryption.js';

function isEncrypted(content: string, chunkSize = 5): boolean {
  const scan = new PdfEncryptionScan();
  const bytes = Buffer.from(content, 'latin1');
  for (let start = 0; start < bytes.length; start += chunkSize) {
    scan.write(bytes.subarray(start, start + chunkSize));
  }
  return scan.isEncrypted;
}

describe('PdfEncryptionScan (attachment serving item 6)', () => {
  it.each([
    ['a trailer with a reference', 'trailer\n<< /Size 8 /Root 1 0 R /Encrypt 7 0 R >>\nstartxref'],
    ['a cross-reference stream', '9 0 obj\n<</Type/XRef/Encrypt 12 0 R/W[1 2 1]>>stream'],
    ['a direct dictionary', 'trailer <</Encrypt<</Filter/Standard/V 2>>>>'],
    ['line breaks inside the entry', '/Encrypt\r\n7\n0\rR'],
    ['an escaped name', '<< /Encr#79pt 7 0 R >>'],
    ['an escaped name in upper-case hex', '<< /#45ncr#79p#74 7 0 R >>'],
  ])('finds %s', (_case, content) => {
    expect(isEncrypted(content)).toBe(true);
  });

  it.each([
    ['a plain file', '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\ntrailer << /Root 1 0 R >>'],
    ['an unrelated name', '<< /EncryptMetadata false >>'],
    ['a null entry', '<< /Encrypt null >>'],
    ['the name in lower case', '<< /encrypt 7 0 R >>'],
  ])('finds nothing in %s', (_case, content) => {
    expect(isEncrypted(content)).toBe(false);
  });
});
