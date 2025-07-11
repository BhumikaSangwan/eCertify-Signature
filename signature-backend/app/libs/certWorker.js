import fs from 'fs';
import path from 'path';
import { signStatus, status } from '../constants/index.js';
import { getFilledDocxBuffer, convertToPdf } from '../router/api/template.js';

export async function processCertificateJob(job) {
  const { doc, requestId, batchIndex, certDir, template, signatureImageUrl } = job.data;
  const templatePath = path.resolve(template.url);

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  if (doc.signStatus === signStatus.rejected && doc.rejectionReason) return;

  doc.signedDate = new Date().toLocaleDateString('en-GB');
  doc.status = status.active;
  doc.signStatus = signStatus.Signed;

  const qrUrl = `${process.env.FRONTEND_URL}/viewDetails/${template.id}/${doc.id}.pdf`;
  const docxBuffer = await getFilledDocxBuffer(templatePath, doc.data, signatureImageUrl, qrUrl);
  const pdfBuffer = await convertToPdf(docxBuffer);

  const outputPath = path.join(certDir, `${doc.id}.pdf`);
  fs.writeFileSync(outputPath, pdfBuffer);
}

