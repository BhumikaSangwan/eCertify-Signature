import zod from 'zod';
import mongoose from 'mongoose';

// ObjectId validator
const objectId = zod.string().refine(val => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

// Signature Zod Schema
export const SignatureSchema = zod.object({
  id: objectId.optional(),
  userId: objectId,
  url: zod
    .string()
    .min(1, 'URL is required')
    .refine(val => val.startsWith('uploads/'), {
      message: 'URL must start with uploads/',
    }),
  status: zod.number().default(1), // status.active
  createdBy: objectId,
  updatedBy: objectId,
  deletedBy: objectId.optional(),
  createdAt: zod.date().optional(),
  updatedAt: zod.date().optional(),
});
