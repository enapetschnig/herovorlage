import { renderToBuffer, renderToStream } from "@react-pdf/renderer";
import { createElement } from "react";
import { DocumentPdf } from "./DocumentPdf";
import type { PdfContact, PdfDocument, PdfTenant } from "./types";

export type { PdfContact, PdfDocument, PdfTenant, PdfPosition, DocumentTypeKey, Currency } from "./types";
export { DocumentPdf } from "./DocumentPdf";

/** Render the document PDF to a Node Buffer (for storage upload, attachments). */
export async function renderDocumentPdf(opts: { document: PdfDocument; tenant: PdfTenant; contact: PdfContact }): Promise<Buffer> {
  return renderToBuffer(createElement(DocumentPdf, opts));
}

/** Render to a stream (for HTTP responses). Returns the underlying readable stream. */
export async function renderDocumentPdfStream(opts: { document: PdfDocument; tenant: PdfTenant; contact: PdfContact }) {
  return renderToStream(createElement(DocumentPdf, opts));
}
