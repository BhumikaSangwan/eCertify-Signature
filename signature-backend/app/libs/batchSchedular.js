import { Queue, Worker, QueueEvents } from 'bullmq';
import redisInstance from '../config/redis.js';
import os from 'os';
import { getIO } from '../config/socket.js';
import TemplateModel from '../models/template.js';
import { signStatus } from '../constants/index.js';
import { processCertificateJob } from './certWorker.js';

const connection = redisInstance;
const certificateQueue = new Queue('certificate-queue', { connection });
const queueEvents = new QueueEvents('certificate-queue', { connection });

const BATCH_SIZE = 50;

// Redis key helpers
const getBatchesKey = requestId => `request:${requestId}:batches`;
const getIndexKey = requestId => `request:${requestId}:batchIndex`;

export async function addRequestToQueue(template, signatureImageUrl, certDir) {
  const batches = [];
  for (let i = 0; i < template.data.length; i += BATCH_SIZE) {
    batches.push(template.data.slice(i, i + BATCH_SIZE));
  }


  await connection.set(getBatchesKey(template.id), JSON.stringify(batches));
  await connection.set(getIndexKey(template.id), '0');

  await enqueueNextBatch(template.id, template, signatureImageUrl, certDir);
}

async function enqueueNextBatch(requestId, template, signatureImageUrl, certDir) {
  const batches = JSON.parse(await connection.get(getBatchesKey(requestId)) || '[]');
  const index = parseInt(await connection.get(getIndexKey(requestId)) || '0');
  
  if (index >= batches.length) return;

  const batch = batches[index];

  for (const doc of batch) {
    await certificateQueue.add('generate-cert', {
      doc,
      requestId,
      batchIndex: index,
      certDir,
      template,
      signatureImageUrl,
    });
  }

  await connection.set(`request:${requestId}:batch:${index}:pending`, batch.length);
}

// BullMQ Worker
const concurrency = os.cpus().length;

new Worker(
  'certificate-queue',
  async job => {
    const { doc, requestId, batchIndex, certDir, template, signatureImageUrl } = job.data;

    await processCertificateJob(job);

    const remaining = await connection.decr(`request:${requestId}:batch:${batchIndex}:pending`);
    if (remaining === 0) {
      const nextIndex = parseInt(await connection.get(getIndexKey(requestId)) || '0') + 1;
      await connection.set(getIndexKey(requestId), nextIndex);

      const batches = JSON.parse(await connection.get(getBatchesKey(requestId)) || '[]');
      if (nextIndex < batches.length) {
        await enqueueNextBatch(requestId, template, signatureImageUrl, certDir);
      } else {
        await connection.del(getBatchesKey(requestId));
        await connection.del(getIndexKey(requestId));

        const templateDoc = await TemplateModel.findOne({ id: requestId });
        if (templateDoc) {
          templateDoc.signStatus = signStatus.Signed;
          await templateDoc.save();
        }

        const io = getIO();
        io.emit('signedReq', requestId);
      }
    }
  },
  { connection, concurrency }
);

