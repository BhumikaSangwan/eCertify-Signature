import Zod from "zod";
import {
	requestSchema,
	requestCreationSchema,
	RequestSchemaForUsers
} from "../responseSchema/request";

import { Client } from "./abstract";

export class RequestClient extends Client {
	constructor(url: string) {
		super(url);
	}

	async getRequests() {
		const res = await this.request("GET", "/api/templates/getRequests");
		const body = Zod.array(Zod.any()).safeParse(res?.data);
		if (!body.success) {
			throw new Error("Invalid data for backend");
		}
		return body.data;
	}

	async signatureRequest({
		officerId,
		requestId,
	}: {
		officerId: string;
		requestId: string;
	}) {
		const response = await this.request("POST", "/api/templates/requestForSignature", {
			data: { officerId, requestId },
		});
		return response.data;
	}

	async getRequest(id: string) {
		const res = await this.request("GET", `/api/templates/${id}`);
		return res.data;
	}

	async deleteDoc({ id, docId }: { id: string; docId: string }) {
		const sentData = { id, docId };
		await this.request("POST", '/api/templates/deleteDoc', { data: sentData });
	}

	async getPreview({ id, docId }: { id: string, docId: string }) {
		const res = await this.request(
			"GET",
			`/api/templates/preview/${id}/${docId}`,
			{
				responseType: "blob"
			}
		);
		return res.data;
	}

	async getDocData({ id, docId }: { id: string, docId: string }) {
		const res = await this.request("GET", `/api/templates/docData/${id}/${docId}`);
		return res.data;
	}

	async getDispatchSlip(id: string) {
		const res = await this.request("GET", `/api/templates/dispatchSlip/${id}`);
		return res.data;
	}

	async dispatchRegister({reqId, registerNumber}: {reqId: string, registerNumber: number}) {
		const res = await this.request("POST", `/api/templates/dispatchRegister/${reqId}`, {
			data: { registerNumber }
		});
		return res.data;
	}

	async rejectDoc({
		reqId, docId, reason
	}: {
		reqId: string;
		docId: string;
		reason: string;
	}) {
		const sentData = { reqId, docId, reason };
		await this.request("POST", '/api/templates/rejectDoc', { data: sentData });
	}

	async getTemplate(id: string) {
		const res = await this.request("GET", `/api/templates/getTemplate/${id}`, { responseType: "blob" });
		return res.data;
	}

	async createNewRequest({
		formData
	}: {
		formData: FormData
	}) {
		const res = await this.request("POST", "/api/templates/createNewRequest", {
			headers: {
				"Content-Type": "multipart/form-data"
			},
			data: formData,
		});

		const result = await res.data;
		return result;
	}

	async uploadExcelData({
		formData
	}: {
		formData: FormData
	}) {
		const res = await this.request("POST", "/api/templates/uploadExcelFile", {
			headers: {
				"Content-Type": "multipart/form"
			},
			data: formData,
		});
		const result = res.data;
		return result;
	}

	async downloadExcelTemplate(id: string) {
		const res = await this.request("GET", `api/templates/downloadExcelTemplate/${id}`, { responseType: "arraybuffer" });
		return res.data;
	}

	// async updateRequest(
	// 	requestId: string,
	// 	requestUpdateData: { name: string; }
	// ) {
	// 	const res = await this.request("PATCH", `/api/requests/${requestId}`, {
	// 		data: requestUpdateData,
	// 	});
	// 	const unprocessedData = requestCreationSchema.safeParse(res?.data);
	// 	if (!unprocessedData.data) {
	// 		throw new Error("Invalid data from backend");
	// 	}
	// 	return unprocessedData.data;
	// }

	async rejectRequest({ rejectionReason, reqId }: { rejectionReason: string, reqId: string }) {
		await this.request("PATCH", `/api/templates/rejectReq/${reqId}`, {
			data: { rejectionReason },
		});
		return;
	}

	async dispatchRequest(requestId: string) {
		await this.request("PATCH", `/api/templates/dispatchReq/${requestId}`);
		return;
	}

	async delegateRequest({ fromOfficerId, toOfficerId, requestId }: { fromOfficerId: string; toOfficerId: string, requestId: string }) {
		await this.request("PATCH", `/api/templates/delegateReq/${requestId}`, {
			data: { fromOfficerId, toOfficerId },
		});
		return;
	}

	async deleteRequest(requestId: string) {
		await this.request("DELETE", `/api/templates/deleteReq/${requestId}`);
		return;
	}

	async printAllDocs(reqId: string): Promise<Blob> {
		const res = await this.request(
			"GET",
			`/api/templates/printAllDocs/${reqId}`,
			{
				responseType: "blob",
				headers: {
					Accept: "application/pdf",
				},
			});

		return res.data;
	}

	async cloneRequest(reqId: string) {
		await this.request("POST", `/api/templates/cloneReq/${reqId}`);
	}

	async downloadAllDocs(reqId: string) {
		const res = await this.request("GET", `/api/templates/downloadAllDocs/${reqId}`, {
			responseType: 'blob',
		});
		console.log("res : ", res.data)
		return res.data;
	}

	async getSignatures(userId: string) {
		const res = await this.request("GET", `/api/signatures/getSignatures/${userId}`);
		const body = Zod.array(Zod.any()).safeParse(res?.data);
		if (!body.success) {
			throw new Error("Invalid data for backend");
		}
		return body.data;
	}

	async addNewSignature(formData: FormData) {
		const res = await this.request("POST", "/api/signatures/uploadSignature", {
			headers: {
				"Content-Type": "multipart/form-data",
			},
			data: formData,
		});

		const body = Zod.any().safeParse(res?.data);
		if (!body.success) {
			throw new Error("Invalid response from backend");
		}
		return body.data;
	}

	async deleteSignature(signatureId: string) {
		return await this.request("DELETE", `/api/signatures/deleteSignature/${signatureId}`);
	}


	async signRequest({ requestId, signatureId, signedBy }: { requestId: string; signatureId: string, signedBy: string }) {
		return await this.request("POST", `/api/signatures/signRequest`, {
			data: { requestId, signatureId, signedBy }
		});
	}

	async getOtpReq(reqId: string) {
		await this.request("POST", `/api/signatures/getOtpReq/${reqId}`);
	}

	async sendOtp({ reqId, otp }: { reqId: string, otp: string }) {
		await this.request("POST", `/api/signatures/verifyOtp`, {
			data: { reqId, otp }
		});
	}
};
