import express from "express";
import multer from "multer";
import path from "path";
import fs, { existsSync } from "fs";
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from "docxtemplater-image-module-free";
import { PDFDocument } from "pdf-lib";
import QRCode from 'qrcode';
import axios from "axios";
import { TemplateSchema } from "../../schema/template.js";
import TemplateModel from "../../models/template.js";
import userModel from "../../models/users.js";
import SignatureModel from "../../models/signatures.js";
import { checkLoginStatus } from "../../middleware/checkAuth.js";
import xlsx from "xlsx";
import libre from "libreoffice-convert";
import { signStatus, status } from '../../constants/index.js';
import archiver from "archiver";
import { fileURLToPath } from 'url';
import crypto from "crypto";
import { getIO } from "../../config/socket.js";
import os from "os";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

const uploadDir = path.resolve("uploads");

if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		let folder = "";

		if (file.fieldname === "template") {
			folder = "template";
		} else if (file.fieldname === "excel") {
			folder = "ExcelFiles";
		}

		const targetDir = path.join(uploadDir, folder);

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		cb(null, targetDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, file.fieldname + "-" + uniqueSuffix + ext);
	},
});

const fileFilter = (req, file, cb) => {
	const allowedTypes = [
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/msword',
		'text/csv'
	];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		const error = new Error('Unsupported file type. Only Excel and Word documents are allowed.');
		error.code = 'UNSUPPORTED_FILE_TYPE';
		cb(error);
	}
};

const upload = multer({ storage, fileFilter });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


router.post("/createNewRequest", upload.single("template"), async (req, res) => {
	try {
		const { totalDocs, rejectedDocs, reqStatus, title } = req.body;
		const createdBy = req.session.userId;
		const updatedBy = req.session.userId;

		if (!req.file) {
			return res.status(400).json({ error: "Template file is required" });
		}

		const templatePath = path.join("uploads", "template", req.file.filename);
		const variables = extractPlaceholders(templatePath);
		const templateVariables = variables.map((varName) => ({
			name: varName,
			required: false,
			showOnExcel: false,
		}));
		const originalFileName = req.file.originalname;


		const formData = {
			url: templatePath,
			status: status.pending,
			templateName: originalFileName,
			createdBy,
			updatedBy,
			templateVariables,
			totalDocs: totalDocs ? Number(totalDocs) : 0,
			rejectedDocs: rejectedDocs ? Number(rejectedDocs) : 0,
			description: title,
		};

		const result = TemplateSchema.safeParse(formData);

		if (!result.success) {
			return res.status(400).json({ error: result.error.format() });
		}

		const newTemplate = new TemplateModel(result.data);
		await newTemplate.save();

		return res.status(201).json({
			message: "Template uploaded and saved successfully",
			data: newTemplate,
		});
	} catch (error) {
		console.error("Error uploading template:", error.message);
		if (error.message.includes("File type not supported")) {
			return res.status(400).json({ error: error.message });
		}
		return res.status(500).json({ error: "Server error while uploading template" });
	}
});

router.get("/getRequests", checkLoginStatus, async (req, res, next) => {
	try {
		const userId = req.session.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const requests = await TemplateModel.find({
			$or: [
				{ createdBy: userId },
				{ assignedTo: userId },
				{ delegatedTo: userId }
			],
			status: { $ne: status.deleted }

		}).sort({ createdAt: -1 });

		const transformedRequests = await Promise.all(
			requests.map(async (request) => {
				let officer = null;
				let totalDocs = request.data.length;
				if (request.assignedTo) {
					try {
						const officerFound = await userModel
							.find({ id: request.assignedTo })
							.select("name")
							.exec();

						if (officerFound.length > 0 && officerFound[0]?.name) {
							officer = officerFound[0].name;
						}
					} catch (err) {
						console.error(`Error finding user ${request.assignedTo}:`, err);
					}
				}

				return {
					...request.toObject(),
					officer,
					totalDocs,
					userId,
				};
			})
		);

		res.json(transformedRequests);
	} catch (error) {
		next(error);
	}
});

router.get("/getReqDocs/:id", checkLoginStatus, async (req, res, next) => {
	try {
		const reqId = req.params.id;
		let result = await TemplateModel.findOne({
			id: reqId,
			status: { $ne: status.deleted }
		},
			{
				id: 1,
				_id: 1,
				data: 1,
				createdBy: 1,
				signStatus: 1,
				description: 1,
			});
		if (!result) {
			return res.status(404).json({ message: "Template not found" });
		}
		return res.json(result);
	} catch (error) {
		next(error);
	}
})

router.post("/requestForSignature", async (req, res) => {
	try {
		const { requestId, officerId } = req.body;

		if (!requestId || !officerId) {
			return res.status(400).json({ message: "Missing requestId or officerId" });
		}

		const template = await TemplateModel.findOne({ id: requestId, status: { $ne: status.deleted } });
		if (!template) {
			return res.status(404).json({ message: "Template request not found" });
		}

		const officer = await userModel.findOne({ id: officerId });
		if (!officer) {
			return res.status(404).json({ message: "Officer not found" });
		}

		template.assignedTo = officerId;
		template.signStatus = signStatus.readForSign;
		template.status = status.active;
		await template.save();
		const totalDocs = template.data.length;
		const userId = req.session.userId;
		const plainTemplate = template.toObject();

		const io = getIO();
		io.to(officerId).emit("newRequest", { ...plainTemplate, userId, totalDocs, officer: officerId });

		res.status(200).json({ message: "Request delegated successfully", data: template });
	} catch (error) {
		console.error("Error delegating request:", error);
		res.status(500).json({ message: "Internal server error while delegating request" });
	}
});

router.patch("/rejectReq/:id", async (req, res) => {
	try {
		const reason = req.body.rejectionReason;
		const template = await TemplateModel.findOne({ id: req.params.id });
		if (!template) {
			return res.status(404).json({ message: "Template request not found" });
		}

		template.signStatus = signStatus.rejected;
		template.rejectionReason = reason;
		await template.save();

		const io = getIO();
		io.emit("rejectedReq", template.id);

		res.status(200).json({ message: "Request rejected successfully" });
	} catch (error) {
		console.error("Error rejecting request:", error);
		res.status(500).json({ message: "Internal server error while rejecting request" });
	}
})

router.patch("/delegateReq/:id", async (req, res) => {
	try {
		const { fromOfficerId, toOfficerId } = req.body;
		const template = await TemplateModel.findOne({ id: req.params.id });
		if (!template) {
			return res.status(404).json({ message: "Template request not found" });
		}
		template.delegatedTo = toOfficerId;
		template.updatedBy = fromOfficerId;
		template.signStatus = signStatus.delegated;
		await template.save();

		const totalDocs = template.data.length;
		const userId = req.session.userId;
		const plainTemplate = template.toObject();

		const io = getIO();
		io.emit("delegatedReq", template.id);
		io.to(toOfficerId).emit("newRequest", { ...plainTemplate, userId, totalDocs, officer: toOfficerId });

		res.status(200).json({ message: "Request delegated successfully", data: template });
	} catch (error) {
		console.error("Error delegating request:", error);
		res.status(500).json({ message: "Internal server error while delegating request" });
	}
})

router.get("/downloadAllDocs/:id", async (req, res, next) => {
	try {
		const reqId = req.params.id;

		const template = await TemplateModel.findOne({ id: reqId });
		if (!template) {
			return res.status(404).json({ message: "Template request not found" });
		}
		const folderPath = path.join(__dirname, "..", "..", "..", "uploads", "certificates", reqId);


		if (!fs.existsSync(folderPath)) {
			return res.status(404).json({ message: "Folder not found" });
		}

		res.setHeader("Content-Type", "application/zip");
		res.setHeader("Content-Disposition", `attachment; filename=request_${req.params.id}_documents.zip`);

		const archive = archiver("zip", { zlib: { level: 9 } });

		archive.on("error", (err) => {
			throw err;
		});

		archive.pipe(res);

		// archive.directory(folderPath, false); // false = no root folder is added
		archive.glob("*.pdf", { cwd: folderPath });

		await archive.finalize();
	} catch (error) {
		console.error("Error downloading all documents:", error);
		next(error);
	}
})

router.get("/printAllDocs/:id", async (req, res, next) => {
	try {
		const reqId = req.params.id;
		const template = await TemplateModel.findOne({ id: reqId });
		if (!template) {
			return res.status(404).json({ message: "Template request not found" });
		}

		const folderPath = path.join(__dirname, "..", "..", "..", "uploads", "certificates", reqId);
		if (!fs.existsSync(folderPath)) {
			return res.status(404).json({ message: "Certificates folder not found" });
		}

		const files = fs.readdirSync(folderPath).filter(file => file.endsWith(".pdf"));
		if (files.length === 0) {
			return res.status(400).json({ message: "No PDF files found in the folder" });
		}

		const mergedPdf = await PDFDocument.create();

		for (const file of files) {
			const filePath = path.join(folderPath, file);
			const pdfBytes = fs.readFileSync(filePath);
			const pdf = await PDFDocument.load(pdfBytes);
			const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
			copiedPages.forEach((page) => mergedPdf.addPage(page));

		}

		const mergedPdfBytes = await mergedPdf.save();

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", "inline; filename=merged_documents.pdf");
		res.send(Buffer.from(mergedPdfBytes));
	} catch (error) {
		next(error);
	}
});

router.patch("/dispatchReq/:id", async (req, res) => {
	try {
		const template = await TemplateModel.findOne({ id: req.params.id });
		if (!template) {
			return res.status(404).json({ message: "Template request not found" });
		}

		template.signStatus = signStatus.dispatched;
		await template.save();

		const io = getIO();
		io.emit("dispatchedReq", template.id);

		res.status(200).json({ message: "Request dispatched successfully" });
	} catch (error) {
		console.error("Error dispatching request:", error);
		res.status(500).json({ message: "Internal server error while dispatching request" });
	}
})

router.get("/getTemplate/:id", async (req, res) => {
	try {
		const template = await TemplateModel.findOne({ id: req.params.id, status: { $ne: status.deleted } });
		if (!template || !template.templateName) {
			return res.status(404).json({ message: "Template not found" });
		}

		const templatePath = path.resolve(template.url);

		const docxBuffer = fs.readFileSync(templatePath);

		const pdfBuffer = await convertToPdf(docxBuffer);

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", "inline; filename=template.pdf");
		res.send(pdfBuffer);

	} catch (err) {
		res.status(500).json({ message: "Server error while converting template to PDF" });
	}
});

router.get("/downloadExcelTemplate/:id", async (req, res) => {
	try {
		const template = await TemplateModel.findOne({ id: req.params.id, status: { $ne: status.deleted } });

		if (!template || !template.templateName) {
			return res.status(404).json({ message: "Template not found" });
		}
		const templateVariables = template.templateVariables;
		const placeholders = templateVariables.map(item => item.name);
		if (!placeholders.length) {
			return res.status(400).json({ message: "No placeholders found in the template" });
		}

		const excelBuffer = createExcelTemplateBuffer(placeholders);

		res.setHeader("Content-Disposition", "attachment; filename=template.xlsx");
		res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

		res.send(excelBuffer);
	} catch (err) {
		console.error("Error in /downloadExcelTemplate/:id:", err);
		res.status(500).json({ message: "Server error while downloading the excel template" });
	}
})

router.delete("/deleteReq/:id", async (req, res, next) => {
	const reqId = req.params.id;

	try {
		const request = await TemplateModel.findOne({ id: reqId });
		request.status = status.deleted;
		await request.save();
		if (!request) {
			return res.status(404).json({ message: "Template request not found" });
		}
		return res.json({ message: "Template request deleted successfully" });
	} catch (error) {
		next(error);
	}
})

router.post("/deleteDoc", async (req, res, next) => {
	const { reqId, docId } = req.body;
	const templateDoc = await TemplateModel.findOne({ id: reqId });
	if (!templateDoc) {
		return res.status(404).json({ message: "Template doc not found" });
	}

	const newData = templateDoc.data.map((doc) => {
		if (doc._id.toString() === docId) {
			return { ...doc, status: status.deleted }
		}
	});
	templateDoc.data = newData;
	templateDoc.totalDocs = (templateDoc.totalDocs ?? 1) - 1;
	await templateDoc.save();
	res.json({ message: "document deleted successfully" });
})

router.get("/preview/:id/:docId", async (req, res, next) => {
	try {
		const { id, docId } = req.params;
		const templateDoc = await TemplateModel.findOne({ id: id });
		if (!templateDoc) {
			return res.status(404).json({ message: "Template not found" });
		}

		const docData = templateDoc.data.find(
			(doc) => doc.id?.toString() === docId.toString() && doc.status !== status.deleted
		);

		if (!docData) {
			return res.status(404).json({ message: "Document not found" });
		}

		const { signedBy, signatureId } = templateDoc;

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", "attachment; filename=preview.pdf");

		if (signedBy && signatureId) {
			const pdfPath = path.join("uploads", "certificates", id, `${docId}.pdf`);
			if (existsSync(pdfPath)) {
				console.log("exists");
				const pdfBuffer = fs.readFileSync(pdfPath);
				res.send(pdfBuffer);
			}
			else {
				console.log("not exists");
				const pdfBuffer = await getUnsignedCertificates(templateDoc, docData.data);
				res.send(pdfBuffer);
			}
		}
		else {
			const pdfBuffer = await getUnsignedCertificates(templateDoc, docData.data);
			res.send(pdfBuffer);
		}


	} catch (error) {
		console.error("Error in /preview route:", error);
		next(error);
	}
});

router.get("/docData/:id/:docId", async (req, res, next) => {
	try {
		const { id, docId } = req.params;
		const templateDoc = await TemplateModel.findOne({ id: id });
		if (!templateDoc) {
			return res.status(404).json({ message: "Template not found" });
		}
		const docData = templateDoc.data.find(doc => doc.id?.toString() === docId.toString() && doc.status !== status.deleted);
		if (!docData) {
			return res.status(404).json({ message: "Document not found" });
		}
		const signatureId = templateDoc.signatureId;
		const signedBy = templateDoc.signedBy;
		const officer = await userModel.findOne({ id: signedBy });
		const officerName = officer?.name || "Unknown Officer";
		const result = {
			id: docData.id,
			signedBy: officerName,
			createdAt: templateDoc.createdAt,
			updatedAt: templateDoc.updatedAt,
			signedDate: templateDoc.signedDate,
			signatureId: templateDoc.signatureId
		};
		res.json({ result });
	} catch (error) {
		console.log("docData error : ", error);
		next(error);
	}
}
)

router.get("/dispatchSlip/:id", async (req, res, next) => {
	try {
		const { id } = req.params;
		const templateDoc = await TemplateModel.findOne({ id: id });
		if (!templateDoc) {
			return res.status(404).json({ message: "Template not found" });
		}
	} catch (error) {
		console.log("dispatch slip error : ", error);
		next(error);
	}
})

router.post("/dispatchRegister/:id", async (req, res, next) => {
	try {
		const { id } = req.params;
		const { registerNumber } = req.body;
		const templateDoc = await TemplateModel.findOne({ id: id });
		if (!templateDoc) {
			return res.status(404).json({ message: "Template not found" });
		}
		res.json({ message: "Dispatch register...", registerNumber });
	} catch (error) {
		console.log("dispatch register error : ", error);
		next(error);
	}
})

router.post("/uploadExcelFile", upload.single("excel"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: "Excel file is required" });
		}
		const userId = req.body.reqId;
		const excelFilePath = path.join("uploads", "ExcelFiles", req.file.filename);
		const template = await TemplateModel.findOne({ id: userId });
		if (!template) {
			return res.status(404).json({ error: "Template not found for current user" });
		}
		if (template.signStatus !== signStatus.unsigned) {
			fs.unlink(excelFilePath, (err) => {
				if (err) console.error("Failed to delete Excel file:", err);
			});
			return res.status(400).json({ error: "Request has already been sent for signature" });
		}

		const templateVariables = template.templateVariables?.map(tv => tv.name) ?? [];
		const { validRows, rejectedIdx, totalCount, headersPresent } = prepareExcelData(excelFilePath, templateVariables);

		if (!headersPresent) {
			return res.status(400).json({
				message: "Excel file headers are invalid/missing, required placeholders !",
				addedRecords: 0,
			});
		}

		if (rejectedIdx !== -1) {
			return res.status(400).json({
				message: `Excel file has missing placeholders at row ${rejectedIdx}`,
			});
		}

		if (!template.data) {
			template.data = [];
		}

		for (const row of validRows) {
			const rowAsStringRecord = {};
			for (const [key, value] of Object.entries(row)) {
				rowAsStringRecord[key] = value != null ? String(value) : "";
			}

			template.data.push({
				data: rowAsStringRecord,
			});
		}

		await template.save();
		return res.status(200).json({
			message: "Excel file processed successfully",
			addedRecords: validRows.length,
		});

	} catch (error) {
		console.error("Error while saving template:", error);
		return res.status(500).json({
			error: "Server error while processing Excel file",
			details: error.message,
		});
	}
});

router.post("/cloneReq/:id", async (req, res, next) => {
	try {
		const reqId = req.params.id;
		const prevReq = await TemplateModel.findOne({ id: reqId });
		if (!prevReq) {
			return res.status(404).json({ message: "Request not found" });
		}
		const newReq = new TemplateModel({
			url: prevReq.url,
			createdBy: prevReq.createdBy,
			updatedBy: prevReq.updatedBy,
			templateName: prevReq.templateName,
			description: prevReq.description,
		});

		await newReq.save();
		return res.status(200).json({ message: "Request cloned successfully" });
	} catch (error) {
		console.log("error cloning req ", error);
		next(error);
	}
})

router.post("/rejectDoc", async (req, res, next) => {
	try {
		const { reqId, docId, reason } = req.body;
		const request = await TemplateModel.findOne({ id: reqId, status: { $ne: status.deleted } });
		if (!request) {
			return res.status(404).json({ message: "Request not found" });
		}
		const targetDoc = request.data.find((item) => item.id.toString() === docId);
		if (!targetDoc) {
			return res.status(404).json({ message: "Document not found in request" });
		}

		targetDoc.signStatus = signStatus.rejected;
		targetDoc.rejectionReason = reason;
		request.rejectedDocs += 1;
		await request.save();
		return res.status(200).json({ message: "Document rejected successfully", updatedReq: request });
	} catch (error) {
		console.log("error rejecting doc ", error);
		next(error);
	}
})

async function getUnsignedCertificates(templateDoc, docData) {
	const signatureImageUrl = null;
	const templatePath = path.resolve(templateDoc.url);
	const docxBuffer = await getFilledDocxBuffer(templatePath, docData, signatureImageUrl);
	const pdfBuffer = await convertToPdf(docxBuffer);
	return pdfBuffer;
}

function prepareExcelData(excelPath, templateVariables) {
	const workbook = xlsx.readFile(excelPath);
	const sheetName = workbook.SheetNames[0];
	const worksheet = workbook.Sheets[sheetName];
	const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

	const headers = Object.keys(jsonData[0] ?? {});
	const headersPresent = templateVariables.every(tv => headers.includes(tv));
	const totalCount = jsonData.length;
	const validRows = [];
	let rejectedIdx = -1;

	if (!headersPresent) {
		return { headersPresent: false };
	}

	for (let i = 0; i < jsonData.length; i++) {
		const row = jsonData[i];
		let isRowValid = true;

		for (const key of templateVariables) {
			if (!row[key] || String(row[key]).trim() === "") {
				isRowValid = false;
				rejectedIdx = i + 2;
				break;
			}
		}

		if (isRowValid) {
			validRows.push(row);
		}

		if (rejectedIdx !== -1) {
			break;
		}
	}

	return { rejectedIdx, validRows, totalCount, headersPresent: true };
}

export const getFilledDocxBuffer = async (
	templatePath,
	data,
	signatureImageUrl = null,
	qrUrl = null
) => {
	let tempQrPath = null;
	try {
		const content = fs.readFileSync(templatePath, "binary");
		const zip = new PizZip(content);

		data["Signature"] = signatureImageUrl ? signatureImageUrl : "";

		if (qrUrl) {
			const tempDir = path.join("uploads", "temp");
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}
			const randomName = crypto.randomBytes(16).toString("hex") + ".png";
			tempQrPath = path.join(tempDir, randomName);


			await QRCode.toFile(tempQrPath, qrUrl, {
				errorCorrectionLevel: "H",
				type: "png",
				width: 200,
				height: 200,
			});

			data["QR"] = tempQrPath;
		}

		const imageModule = new ImageModule({
			centered: false,
			getImage(tagValue, tagName) {
				if (fs.existsSync(tagValue)) {
					return fs.readFileSync(tagValue);
				}
				return Buffer.alloc(0);
			},
			getSize(tagValue, tagName) {
				if (tagName === "QR") {
					return [150, 150];
				}
				if (tagName === "Signature") {
					return [150, 50];
				}
				return [150, 150];
			}
		});

		const doc = new Docxtemplater(zip, {
			modules: [imageModule],
			paragraphLoop: true,
			linebreaks: true,
		});

		doc.render(data);

		return doc.getZip().generate({ type: "nodebuffer" });

	} catch (err) {
		console.error("Error rendering DOCX with image/QR:", err);
		throw err;
	}
	finally {
		if (tempQrPath && fs.existsSync(tempQrPath)) {
			fs.unlinkSync(tempQrPath);
		}
	}
};

// export const convertToPdf = (docxBuffer) => {
// 	return new Promise((resolve, reject) => {
// 		if (!docxBuffer || !Buffer.isBuffer(docxBuffer) || docxBuffer.length === 0) {
// 			return reject(new Error("Invalid DOCX buffer: Buffer is empty or malformed"));
// 		}

// 		libre.convert(docxBuffer, ".pdf", undefined, (err, done) => {
// 			if (err) {
// 				console.error("Error converting to PDF:", err);
// 				reject(err);
// 			} else {
// 				resolve(done);
// 			}
// 		});
// 	});
// };

export const convertToPdf = async (docxBuffer) => {
	const tmpDir = os.tmpdir();
	const docxPath = path.join(tmpDir, `${uuidv4()}.docx`);
	const pdfPath = docxPath.replace(/\.docx$/, '.pdf');

	fs.writeFileSync(docxPath, docxBuffer);

	return new Promise((resolve, reject) => {
		libre.convert(fs.readFileSync(docxPath), '.pdf', undefined, (err, done) => {
			fs.unlinkSync(docxPath); // Clean up temp docx
			if (err) {
				console.error("LibreOffice conversion failed:", err);
				return reject(err);
			}
			resolve(done);
		});
	});
};

// export const convertToPdf = (docxBuffer) => {
// 	return new Promise((resolve, reject) => {
// 		libre.convert(docxBuffer, ".pdf", undefined, (err, done) => {
// 			if (err) {
// 				console.error("Error converting to PDF:", err);
// 				reject(err);
// 			} else {
// 				resolve(done);
// 			}
// 		});
// 	});
// };

function extractPlaceholders(filePath) {
	const content = fs.readFileSync(filePath, 'binary');
	const zip = new PizZip(content);
	const doc = new Docxtemplater(zip, {
		paragraphLoop: true,
		linebreaks: true,
	});

	const text = doc.getFullText();
	const regex = /{(.*?)}/g;
	const matches = new Set();
	let match;

	while ((match = regex.exec(text)) !== null) {
		const raw = match[1].trim();

		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw)) {
			continue;
		}

		// Skip dynamic placeholders like {% something }
		if (/^%\s*\w+/.test(raw)) {
			continue;
		}

		matches.add(raw);
	}

	return Array.from(matches);
}


function createExcelTemplateBuffer(headers) {
	const worksheetData = [headers];
	const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
	const workbook = xlsx.utils.book_new();
	xlsx.utils.book_append_sheet(workbook, worksheet, "Template");


	const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

	return buffer;
}


export default router;
