import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { convertToPdf, getFilledDocxBuffer } from '../router/api/template.js';
import { status, signStatus } from '../constants/index.js';

(async () => {
  const { meta, batch } = workerData;
  const { template, signatureImageUrl, certDir, templatePath } = meta;

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  for (const doc of batch) {
    try {
      if (doc.signStatus === signStatus.rejected && doc.rejectionReason) continue;

      doc.signedDate = new Date().toLocaleDateString('en-GB');
      doc.status = status.active;
      doc.signStatus = signStatus.Signed;

      const qrUrl = `${process.env.FRONTEND_URL}/viewDetails/${template.id}/${doc.id}.pdf`;
      const docxBuffer = await getFilledDocxBuffer(templatePath, doc.data, signatureImageUrl, qrUrl);
      const pdfBuffer = await convertToPdf(docxBuffer);

      const outputPath = path.join(certDir, `${doc.id}.pdf`);
      fs.writeFileSync(outputPath, pdfBuffer);
      console.log(`Certificate generated: ${outputPath}`);
    } catch (err) {
      console.error(`Error generating certificate for doc ID ${doc.id}:`, err);
    }
  }

  parentPort.postMessage({ done: true });
})();
