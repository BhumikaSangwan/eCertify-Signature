import mongoose from 'mongoose';
import { signStatus, status } from '../constants/index.js';

export const schema = new mongoose.Schema({
    'id': {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
        required: true,
    },
    'url': {
        type: String,
        required: true,
    },
    'dispatchRegisterIndex': {
        type: Number,
    },
    'status': {
        type: Number,
        required: true,
        default: status.active,
    },
    'description': {
        type: String,
        required: true,
    },
    'templateName': {
        type: String,
        required: true,
    },
    'templateVariables': [{
        name: String,
        required: Boolean,
        showOnExcel: Boolean,
    }],
    'signedDate': {
        type: Date,
    },
    'createdBy': {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    'updatedBy': {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    'signStatus': {
        type: Number,
        default: signStatus.unsigned,
    },
    'data': [{
        id: {
            type: mongoose.Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId(),
        },
        data: {
            type: mongoose.Schema.Types.Mixed,

        },
        signedDate: {
            type: Date,
        },
        signStatus: {
            type: Number,
            default: signStatus.unsigned,
        },
        status: {
            type: Number,
            required: true,
            default: status.pending,
        },
        url: {
            type: String,
        },
        rejectionReason: {
            type: String,
        },
    }],
    'rejectedDocs': {
        type: Number,
        default: 0
    },
    'assignedTo': {
        type: mongoose.Schema.Types.ObjectId,
    },
    'signatureId': {
        type: mongoose.Schema.Types.ObjectId,
    },
    'signedBy': {
        type: mongoose.Schema.Types.ObjectId,
    },
    'signOtp' : {
        type: String
    },
    'signedDocs' : {
        type: Number,
        default: 0
    },
    'otpGeneratedAt' : {
        type: Date
    },
    'rejectionReason': {
        type: String,
    },
    'delegationReason': {
        type: String,
    },
    'delegatedTo': {
        type: mongoose.Schema.Types.ObjectId,
    },
}, { timestamps: true });

const model = mongoose.model('templates', schema);
export default model;
