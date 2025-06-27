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
import '../../../app/config/env.js';


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

router.patch("/signRequest", async (req, res) => {
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
		const template = await TemplateModel.findOne({ _id: requestId, status: { $ne: status.deleted } });
		if (!template) {
			return res.status(404).json({ error: "Template not found" });
		}
		template.signedBy = signedBy;
		template.signStatus = signStatus.Signed;
		template.status = status.active;
		template.signatureId = signatureId;

		const certDir = path.join("uploads", "certificates", template._id.toString());
		generateCertificates(template, signatureImageUrl, certDir);

		await template.save();
		res.status(200).json({ message: "Request signed successfully", data: template });
	} catch (error) {
		res.status(500).json({ error: "Failed to sign request" });
	}
})

async function generateCertificates(template, signatureImageUrl, certDir) {
	try {
		if (!fs.existsSync(certDir)) {
			await fs.promises.mkdir(certDir, { recursive: true });
		}
		const dataList = template.data;
		const templatePath = path.resolve(template.url);

		for (const doc of dataList) {
			const today = new Date();
			doc.signedDate = today.toLocaleDateString('en-GB');
			doc.status = status.active;
			doc.signStatus = signStatus.Signed;

			const baseUrl = process.env.CURRENT_SERVER_URL;
			const qrUrl = `${baseUrl}/uploads/certificates/${template._id}/${doc._id}.pdf`;


			const docxBuffer = await getFilledDocxBuffer(templatePath, doc.data, signatureImageUrl, qrUrl);
			const pdfBuffer = await convertToPdf(docxBuffer);

			const outputPath = path.join(certDir, `${doc._id}.pdf`);
			fs.writeFileSync(outputPath, pdfBuffer);
		}

	} catch (error) {
		console.error("Error generating certificates : ", error);
	}
}

async function hasDynamicPlaceholder(templateId) {
	try {
		const template = await TemplateModel.findById(templateId);
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

		return dynamicPlaceholderRegex.test(text);
	} catch (err) {
		console.error("Error checking dynamic placeholder:", err);
		return false;
	}
}



export default router;