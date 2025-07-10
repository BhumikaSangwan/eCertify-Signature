// import path from 'path';
// import fs from 'fs';
// import TemplateModel from "../models/template.js";
// import { signStatus, status } from '../constants/index.js';
// import { convertToPdf, getFilledDocxBuffer } from '../router/api/template.js';
// import { getIO } from '../config/socket.js';

// const BATCH_SIZE = 100;
// const MAX_CONCURRENCY = 4;

// export const requestQueueMap = new Map();
// let activeWorkers = 0;

// export function addRequestToQueue(template, signatureImageUrl, certDir) {
//     const dataList = template.data;

//     const batches = [];
//     for (let i = 0; i < dataList.length; i += BATCH_SIZE) {
//         batches.push(dataList.slice(i, i + BATCH_SIZE));
//     }

//     requestQueueMap.set(template.id, {
//         meta: {
//             template,
//             signatureImageUrl,
//             certDir,
//             templatePath: path.resolve(template.url)
//         },
//         batches
//     });

//     processNextBatchCycle();
// }

// async function processNextBatchCycle() {
//     if (activeWorkers >= MAX_CONCURRENCY || requestQueueMap.size === 0) return;

//     for (const [requestId, requestData] of requestQueueMap.entries()) {
//         if (activeWorkers >= MAX_CONCURRENCY) break;

//         const { meta, batches } = requestData;
//         const batch = batches.shift();
//         if (!batch) continue;

//         activeWorkers++;

//         processBatch(meta, batch)
//             .then(async () => {
//                 if (batches.length === 0) {
//                     requestQueueMap.delete(requestId);
//                     const template = await TemplateModel.findOne({ id: requestId });
//                     if (template) {
//                         template.signStatus = signStatus.Signed;
//                         await template.save();
//                     }
//                     const io = getIO();
//                     io.emit("signedReq", requestId);
//                     console.log("-------------------all cert generated for : ", requestId)
//                 }
//                 activeWorkers--;
//                 setImmediate(processNextBatchCycle);
//             })
//             .catch((err) => {
//                 console.error(`Error processing batch for ${requestId}:`, err);
//                 activeWorkers--;
//                 setImmediate(processNextBatchCycle);
//             });
//     }
// }

// async function processBatch(meta, batchDocs) {
//     const { template, signatureImageUrl, certDir, templatePath } = meta;

//     if (!fs.existsSync(certDir)) {
//         await fs.promises.mkdir(certDir, { recursive: true });
//     }

//     for (const doc of batchDocs) {
//         try {
//             if (doc.signStatus === signStatus.rejected && doc.rejectionReason) continue;

//             doc.signedDate = new Date().toLocaleDateString('en-GB');
//             doc.status = status.active;
//             doc.signStatus = signStatus.Signed;

//             const qrUrl = `${process.env.FRONTEND_URL}/viewDetails/${template.id}/${doc.id}.pdf`;
//             const docxBuffer = await getFilledDocxBuffer(templatePath, doc.data, signatureImageUrl, qrUrl);
//             const pdfBuffer = await convertToPdf(docxBuffer);

//             const outputPath = path.join(certDir, `${doc.id}.pdf`);
//             fs.writeFileSync(outputPath, pdfBuffer);

//             console.log(`Certificate generated: ${outputPath}`);
//         } catch (err) {
//             console.error(`Error generating certificate for doc ID: ${doc.id}`, err);
//         }
//     }

// }

import path, { join } from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';
import os from 'os';
import { fileURLToPath } from 'url';
import { getIO } from '../config/socket.js';
import TemplateModel from '../models/template.js';
import { signStatus } from '../constants/index.js';

const BATCH_SIZE = 50;
const MAX_WORKERS = os.cpus().length;

const workers = new Set(); // Currently active worker threads
export const requestQueueMap = new Map(); // { [requestId]: { meta, batches } }
const requestIdsInProgress = new Set(); // Tracks which requests already have a batch running

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.resolve(__dirname, './certWorker.js');

function runWorker(meta, batch) {
  const safeMeta = {
    template: {
      id: meta.template.id.toString(),
      url: meta.template.url,
    },
    signatureImageUrl: meta.signatureImageUrl,
    certDir: meta.certDir,
    templatePath: meta.templatePath
  };

  const safeBatch = batch.map(doc => ({
    id: doc.id.toString(),
    data: doc.data,
    signStatus: doc.signStatus,
    status: doc.status,
    rejectionReason: doc.rejectionReason || null,
  }));

  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, './certWorker.js'), {
      workerData: { meta: safeMeta, batch: safeBatch }
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

export function addRequestToQueue(template, signatureImageUrl, certDir) {
  const dataList = template.data;
  const batches = [];
  for (let i = 0; i < dataList.length; i += BATCH_SIZE) {
    batches.push(dataList.slice(i, i + BATCH_SIZE));
  }

  requestQueueMap.set(template.id, {
    meta: {
      template,
      signatureImageUrl,
      certDir,
      templatePath: path.resolve(template.url)
    },
    batches
  });

  processNextBatchCycle(); // kick off batch processing
}

async function processNextBatchCycle() {
  if (workers.size >= MAX_WORKERS || requestQueueMap.size === 0) return;

  // Prioritize work while there are free workers
  while (workers.size < MAX_WORKERS) {
    let scheduled = false;

    for (const [requestId, requestData] of requestQueueMap.entries()) {
      // skip if already running a batch from this request
      if (requestIdsInProgress.has(requestId)) continue;

      const { meta, batches } = requestData;
      const batch = batches.shift();

      if (!batch) {
        // all batches done
        requestQueueMap.delete(requestId);
        requestIdsInProgress.delete(requestId);

        const template = await TemplateModel.findOne({ id: requestId });
        if (template) {
          template.signStatus = signStatus.Signed;
          await template.save();
        }

        const io = getIO();
        io.emit("signedReq", requestId);
        console.log("✅ All certificates generated for:", requestId);
        continue;
      }

      try {
        requestIdsInProgress.add(requestId);
        workers.add(requestId);

        runWorker(meta, batch)
          .then(() => {
            requestIdsInProgress.delete(requestId);
            workers.delete(requestId);
            processNextBatchCycle(); // try to schedule more
          })
          .catch(err => {
            console.error(`❌ Worker error for request ${requestId}:`, err);
            requestIdsInProgress.delete(requestId);
            workers.delete(requestId);
            processNextBatchCycle();
          });

        scheduled = true;
        break; // go to next while() iteration to reevaluate available slots
      } catch (err) {
        console.error(`Error starting worker for request ${requestId}:`, err);
        requestIdsInProgress.delete(requestId);
        workers.delete(requestId);
      }
    }

    if (!scheduled) break; // no eligible requests to schedule
  }
}


// import path, { join } from 'path';
// import fs from 'fs';
// import { Worker } from 'worker_threads';
// import os from 'os';
// import { fileURLToPath } from 'url';
// import { getIO } from '../config/socket.js';
// import TemplateModel from '../models/template.js';
// import { signStatus } from '../constants/index.js';

// const BATCH_SIZE = 100;
// const MAX_WORKERS = os.cpus().length;
// const workers = new Set();
// export const requestQueueMap = new Map();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const workerPath = path.resolve(__dirname, './certWorker.js');



// function runWorker(meta, batch) {
//   // Convert meta and batch to plain JSON-serializable objects
//   const safeMeta = {
//     template: {
//       id: meta.template.id.toString(),
//       url: meta.template.url,
//       // any other fields you need — just avoid functions and ObjectId
//     },
//     signatureImageUrl: meta.signatureImageUrl,
//     certDir: meta.certDir,
//     templatePath: meta.templatePath
//   };

//   const safeBatch = batch.map(doc => ({
//     id: doc.id.toString(),
//     data: doc.data, // ensure `data` is plain JSON
//     signStatus: doc.signStatus,
//     status: doc.status,
//     rejectionReason: doc.rejectionReason || null,
//   }));

//   return new Promise((resolve, reject) => {
//     const worker = new Worker(join(__dirname, './certWorker.js'), {
//       workerData: { meta: safeMeta, batch: safeBatch }
//     });

//     worker.on('message', resolve);
//     worker.on('error', reject);
//     worker.on('exit', code => {
//       if (code !== 0) reject(new Error(`Worker stopped with code ${code}`));
//     });
//   });
// }

// export function addRequestToQueue(template, signatureImageUrl, certDir) {
//     const dataList = template.data;
//     const batches = [];
//     for (let i = 0; i < dataList.length; i += BATCH_SIZE) {
//         batches.push(dataList.slice(i, i + BATCH_SIZE));
//     }

//     requestQueueMap.set(template.id, {
//         meta: {
//             template,
//             signatureImageUrl,
//             certDir,
//             templatePath: path.resolve(template.url)
//         },
//         batches
//     });

//     processNextBatchCycle();
// }

// let activeProcessing = false;

// async function processNextBatchCycle() {
//   if (activeProcessing || workers.size >= MAX_WORKERS || requestQueueMap.size === 0) return;

//   activeProcessing = true;

//   const entries = Array.from(requestQueueMap.entries());

//   for (const [requestId, requestData] of entries) {
//     if (workers.size >= MAX_WORKERS) break;

//     const { meta, batches } = requestData;
//     const batch = batches.shift();
//     if (!batch) {
//       requestQueueMap.delete(requestId);
//       const template = await TemplateModel.findOne({ id: requestId });
//       if (template) {
//         template.signStatus = signStatus.Signed;
//         await template.save();
//       }

//       const io = getIO();
//       io.emit("signedReq", requestId);
//       console.log("All certificates generated for:", requestId);
//       continue;
//     }

//     try {
//       workers.add(requestId);
//       await runWorker(meta, batch);
//     } catch (err) {
//       console.error(`Worker error for request ${requestId}:`, err);
//     } finally {
//       workers.delete(requestId);
//     }
//   }

//   activeProcessing = false;

//   // Schedule next cycle
//   setTimeout(processNextBatchCycle, 100);
// }

// // async function processNextBatchCycle() {
// //     if (workers.size >= MAX_WORKERS || requestQueueMap.size === 0) return;

// //     for (const [requestId, requestData] of requestQueueMap.entries()) {
// //         if (workers.size >= MAX_WORKERS) break;

// //         const { meta, batches } = requestData;
// //         const batch = batches.shift();
// //         if (!batch) continue;

// //         try {
// //             await runWorker( meta, batch );

// //             if (batches.length === 0) {
// //                 requestQueueMap.delete(requestId);
// //                 const template = await TemplateModel.findOne({ id: requestId });
// //                 if (template) {
// //                     template.signStatus = signStatus.Signed;
// //                     await template.save();
// //                 }

// //                 const io = getIO();
// //                 io.emit("signedReq", requestId);
// //                 console.log("All certificates generated for:", requestId);
// //             }
// //         } catch (err) {
// //             console.error("Worker error:", err);
// //         }

// //         setImmediate(processNextBatchCycle);
// //     }
// // }

