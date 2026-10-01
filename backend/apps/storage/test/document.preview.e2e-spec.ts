import { DocumentPreviewUndecodableError } from '@modules/document/domain/services/document.preview.service';
import { PdfjsDocumentPreviewServiceImpl } from '@modules/document/infrastructure/services/pdfjs.document.preview.service.impl';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';

/** A one-page PDF of the given size in points, a black square drawn on it. */
const onePagePdf = (width: number, height: number): Buffer => {
  const content = '0 0 0 rg 50 50 100 100 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const offsets: number[] = [];
  let pdf = '%PDF-1.4\n';

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
};

class ImpatientPreviewService extends PdfjsDocumentPreviewServiceImpl {
  protected readonly timeoutMs = 1;
}

/**
 * The real renderer — pdf.js and `@napi-rs/canvas` in a worker thread. It needs no server, but it
 * runs here, on `node:test`: pdf.js is ESM only, which Jest's runtime cannot load (ADR-0017).
 */
describe('PdfjsDocumentPreviewServiceImpl', () => {
  const service = new PdfjsDocumentPreviewServiceImpl();

  it('draws the first page as a webp of at most 512 px a side', async () => {
    const preview = await service.render(onePagePdf(595, 842));

    assert.ok(preview.isRight(), preview.isLeft() ? preview.value.message : '');
    assert.equal(preview.value.contentType, 'image/webp');

    const { format, width, height } = await sharp(preview.value.body).metadata();
    assert.equal(format, 'webp');
    assert.deepEqual([width, height], [362, 512]);
  });

  it('fits a landscape page by its width', async () => {
    const preview = await service.render(onePagePdf(842, 595));
    assert.ok(preview.isRight());

    const { width, height } = await sharp(preview.value.body).metadata();
    assert.deepEqual([width, height], [512, 362]);
  });

  it('leaves the rest of Node’s buffer pool alone', async () => {
    // Both small enough to be slices of one shared pool: handing the document over must copy it.
    const document = onePagePdf(100, 100);
    const neighbour = Buffer.from('still readable');

    assert.ok((await service.render(document)).isRight());
    assert.equal(neighbour.toString(), 'still readable');
  });

  it('answers undecodable for bytes that are no PDF', async () => {
    const preview = await service.render(Buffer.from('not a pdf at all'));

    assert.ok(preview.isLeft());
    assert.ok(preview.value instanceof DocumentPreviewUndecodableError, preview.value.message);
  });

  it('gives up on a page that takes too long, as undecodable', async () => {
    const preview = await new ImpatientPreviewService().render(onePagePdf(595, 842));

    assert.ok(preview.isLeft());
    assert.ok(preview.value instanceof DocumentPreviewUndecodableError);
    assert.match(preview.value.message, /took over/);
  });
});
