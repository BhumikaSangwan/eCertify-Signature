import { Router } from 'express';
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs, { existsSync } from "fs";
import PizZip from "pizzip";
import Docxtemplater from 'docxtemplater';
import { checkLoginStatus } from "../../middleware/checkAuth.js";
import Signature from "../../models/signatures.js";
import TemplateModel from "../../models/template.js";
import userModel from "../../models/users.js";
import { SignatureSchema } from "../../schema/signature.js";
import { status, signStatus } from '../../constants/index.js';
import { convertToPdf, getFilledDocxBuffer } from './template.js';
import { bcryptPass, compareBcrypt, generateOtp } from "../../libs/encryption.js";
import { sendSignatureOtp } from '../../libs/communication.js';
import { getIO } from "../../config/socket.js";
import '../../../app/config/env.js';
import { addRequestToQueue } from '../../libs/batchSchedular.js';

const router = Router();

// Ensure uploads directory exists
const uploadDir = "uploads/signatures";
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		if (file.fieldname === "signature") {
			cb(null, uploadDir);
		}
		else {
			cb(new Error("Invalid field name"));
		}
	},
	filename: function (req, file, cb) {
		const ext = path.extname(file.originalname).toLowerCase();
		const userId = req.body.userId || "anonymous";
		const uniqueName = `${userId}_${uuidv4()}_${Date.now()}${ext}`;
		cb(null, uniqueName);
	},
});

const fileFilter = function (req, file, cb) {
	const allowedTypes = /jpeg|jpg|png|gif/;
	const ext = path.extname(file.originalname).toLowerCase();
	const mime = file.mimetype;

	if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
		cb(null, true);
	} else {
		cb(new Error("Only image files (jpeg, png, gif) are allowed"));
	}
};

const uploadSignature = multer({
	storage,
	fileFilter,
	limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

router.post("/uploadSignature", checkLoginStatus, uploadSignature.single("signature"), async (req, res) => {
	try {
		const { userId, createdBy, updatedBy } = req.body;

		if (!req.file) {
			return res.status(400).json({ error: "No file uploaded" });
		}

		const relativePath = `uploads/signatures/${req.file.filename}`;

		const data = {
			userId,
			createdBy,
			updatedBy,
			url: relativePath
		};

		const result = SignatureSchema.safeParse(data);

		if (!result.success) {
			console.error(result.error.errors);
			return res.status(400).json({ error: result.error.format() });
		}

		const signature = new Signature(result.data);
		await signature.save();

		res.status(201).json({ message: "Signature uploaded successfully" });
	} catch (error) {
		res.status(500).json({ error: "Failed to upload signature" });
	}
});

router.get("/getSignatures/:id", async (req, res) => {
	try {
		const userId = req.params.id;
		const signatures = await Signature.find({ userId, status: { $ne: status.deleted } });
		res.status(200).json(signatures);
	} catch (error) {
		console.error("Error fetching signatures:", error);
		res.status(500).json({ error: "Failed to fetch signatures" });
	}
});

router.delete("/deleteSignature/:id", async (req, res) => {
	try {
		const sId = req.params.id;
		const signature = await Signature.findOne({ id: sId });
		signature.status = status.deleted;
		await signature.save();
		res.status(200).json({ message: "Signature deleted successfully" });
	} catch (error) {
		console.error("Error deleting signature:", error);
		res.status(500).json({ error: "Failed to delete signature" });
	}
})

router.post("/getOtpReq/:id", async (req, res) => {
	try {
		const reqId = req.params.id;
		const request = await TemplateModel.findOne({ id: reqId, status: { $ne: status.deleted } });
		if (!request) {
			return res.status(404).json({ error: "Request not found" });
		}
		const otp = generateOtp(6).toString();
		const encryptedOtp = await bcryptPass(otp)
		request.signOtp = encryptedOtp;
		request.otpGeneratedAt = Date.now();
		await request.save();

		// Auto-clear OTP after 10 minutes
		setTimeout(async () => {					
			const doc = await TemplateModel.findOne({ id: reqId });
			if (!doc) return;

			const elapsed = Date.now() - new Date(doc.otpGeneratedAt).getTime();
			if (elapsed >= 10 * 60 * 1000) {
				doc.signOtp = '';
				doc.otpGeneratedAt = null;
				await doc.save();
			}
		}, 10 * 60 * 1000);

		const userId = request?.delegatedTo || request.assignedTo;
		const user = await userModel.findOne({ id: userId, status: { $ne: status.deleted } });
		const email = user.email;
		sendSignatureOtp(email, otp);

		res.status(200).json({ message: "OTP sent successfully", otp: otp });
	} catch (error) {
		console.error("Error sending OTP:", error);
		res.status(500).json({ error: "Failed to send OTP" });
	}
})

router.post("/verifyOtp", async (req, res) => {
	try {
		const { reqId, otp } = req.body;
		const request = await TemplateModel.findOne({ id: reqId, status: { $ne: status.deleted } });
		if (!request) {
			return res.status(404).json({ error: "Request not found" });
		}
		const isExpired = Date.now() - new Date(request.otpGeneratedAt).getTime() > 10 * 60 * 1000;
		if (isExpired) {
			return res.status(400).json({ error: "OTP has expired. Please request a new one." });
		}
		const originalOtp = request.signOtp;
		const validOtp = await compareBcrypt(originalOtp, otp.toString());
		if (!validOtp) {
			return res.status(400).json({ error: "Invalid OTP" });
		}
		res.json({ message: "Successfully verified" })
	} catch (error) {
		res.status(500).json({ error: "Failed to verify OTP" });
	}
})

router.post("/signRequest", async (req, res) => {
	try {
		const { requestId, signatureId, signedBy } = req.body;
		const hasPlaceholder = await hasDynamicPlaceholder(requestId);
		if (!hasPlaceholder) {
			return res.status(404).json({ error: "No signature placeholder found in the template" });
		}
		const signature = await Signature.findOne({ id: signatureId, status: { $ne: status.deleted } });
		if (!signature) {
			return res.status(404).json({ error: "Signature not found" });
		}
		const signatureImageUrl = signature.url;
		const signingUser = await userModel.findOne({ id: signedBy, status: { $ne: status.deleted } });
		if (!signingUser) {
			return res.status(404).json({ error: "User not found" });
		}
		const template = await TemplateModel.findOne({ id: requestId, status: { $ne: status.deleted } });
		if (!template) {
			return res.status(404).json({ error: "Template not found" });
		}
		template.signedBy = signedBy;
		template.signStatus = signStatus.inProcess;
		template.status = status.active;
		template.signatureId = signatureId;
		template.signedDate = new Date();

		await template.save();
		const io = getIO();

		io.emit("progressReq", template.id);

		const certDir = path.join("uploads", "certificates", template.id.toString());

		addRequestToQueue(template, signatureImageUrl, certDir);

		res.status(200).json({ message: "Request signed successfully", data: template });
	} catch (error) {
		res.status(500).json({ error: "Failed to sign request" });
	}
})


async function hasDynamicPlaceholder(templateId) {
	try {
		const template = await TemplateModel.findOne({ id: templateId, status: { $ne: status.deleted } });
		if (!template || !template.url) return false;

		const templatePath = path.resolve(template.url);
		if (!fs.existsSync(templatePath)) return false;

		const content = fs.readFileSync(templatePath, 'binary');
		const zip = new PizZip(content);
		const doc = new Docxtemplater(zip, {
			paragraphLoop: true,
			linebreaks: true,
		});

		const text = doc.getFullText();

		// Match a dynamic placeholder like {%Signature}
		const dynamicPlaceholderRegex = /{\%\s*Signature\s*}/i;
		const qr = /{%\s*QR\s*}/i;
		return dynamicPlaceholderRegex.test(text) && qr.test(text);;
	} catch (err) {
		console.error("Error checking dynamic placeholder:", err);
		return false;
	}
}



export default router;