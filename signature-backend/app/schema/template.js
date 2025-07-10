import zod from 'zod';
import mongoose from 'mongoose';
import path from 'path';

const objectId = zod.string().refine(val => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
});

export const TemplateSchema = zod.object({
    url: zod.string(),
    dispatchRegisterIndex: zod.number().optional(),
    status: zod.number().default(0), 
    description: zod.string().min(1, 'Title is required').optional(), 
    templateName: zod.string().min(1, 'Original file name is required').optional(),
    templateVariables: zod.array(
        zod.object({
            name: zod.string().optional(),
            required: zod.boolean().optional(),
            showOnExcel: zod.boolean().optional(),
        })
    ).optional(),
    signedDate: zod.date().optional(),
    createdBy: objectId.optional(),
    updatedBy: objectId.optional(),
    signStatus: zod.number().default(0),
    data: zod.array(
        zod.object({
            id: objectId.optional(),
            data: zod.record(zod.string(), zod.string()).optional(),
            signedDate: zod.date().optional(),
            signStatus: zod.number().optional(),
            url: zod.string().optional(),
            rejectionReason: zod.string().optional(),
        })
    ).optional(),
    rejectedDocs: zod.number(),
    assignedTo: objectId.optional(),
    signatureId: objectId.optional(),
    signedBy: objectId.optional(),
    signOtp: zod.string().optional(),
    rejectionReason: zod.string().optional(),
    delegationReason: zod.string().optional(),
    delegatedTo: objectId.optional(),
    totalDocs: zod.number().int().nonnegative().default(0).optional(),
    rejectedDocs: zod.number().int().nonnegative().default(0).optional(),
});