import React, { useEffect, useState } from "react";
import {
	Button,
	Drawer,
	Form,
	Input,
	Popconfirm,
	message,
	Upload,
	Tag,
	Flex,
	Select,
	Modal,
	Row,
	Col,
	Card,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import CustomTable from "../components/CustomTable";
import MainAreaLayout from "../components/main-layout/main-layout";
import { courtClient, useAppStore, requestClient, userClient } from "../store";
import { useNavigate } from "react-router-dom";
import socket from "../client/socket";

interface Request {
	id: string;
	title: string;
	totalDocs: number;
	rejectedDocs: number;
	reqStatus: number;
	createdAt: string;
	officer: string;
	assignedTo: string;
	createdBy: string;
	delegatedTo: string | null;
	_id?: string;
	userId: string;
	signStatus?: number;
	key?: string;
	description?: string;
	signedDocs?: number;
}

interface DocumentProgressProps {
	signedDocs: number;
	totalDocs: number;
}

const Requests: React.FC = () => {
	const [requests, setRequests] = useState<Request[]>([]);
	const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [form] = Form.useForm();
	const [otpForm] = Form.useForm();
	const [currentRequest, setCurrentRequest] = useState<Request | null>(null);
	const [, setCurrentPage] = useState<number>(1);
	const [searchTerm, setSearchTerm] = useState("");
	const [uploadedFile, setUploadedFile] = useState<File | null>(null);
	const [officerList, setOfficerList] = useState<{ label: string; value: string }[]>([]);
	const [role, setRole] = useState<number>(3);
	const [userId, setUserId] = useState<string>('');
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
	const [fileList, setFileList] = useState<any[]>([]);
	const [selectedDelegateRequestId, setSelectedDelegateRequestId] = useState<string | null>(null);
	const [delegatableUsers, setDelegatableUsers] = useState<{ label: string; value: string }[]>([]);

	const [showSignatureModal, setShowSignatureModal] = useState(false);
	const [signatures, setSignatures] = useState<any[]>([]);
	const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);

	const [rejectionFormVisible, setRejectionFormVisible] = useState(false);
	const [rejectionReason, setRejectionReason] = useState('');
	const [rejectingRequest, setRejectingRequest] = useState<string>('');

	const [showDispatchRegisterModal, setShowDispatchRegisterModal] = useState(false);
	const [dispatchRegisterReqId, setDispatchRegisterReqId] = useState<string | null>(null);
	const [dispatchRegisterNumber, setDispatchRegisterNumber] = useState<number | null>();

	const [showOtpModal, setShowOtpModal] = useState(false);
	const [otp, setOtp] = useState('');

	const backendUrl = import.meta.env.VITE_BACKEND_URL;

	const navigate = useNavigate();

	useEffect(() => {
		socket.on("newRequest", addNewRequest);
		socket.on("signedReq", handleSignedReqStatus);
		socket.on("progressReq", handleSigningReqStatus);
		socket.on("rejectedReq", handleRejectedReqStatus);
		socket.on("delegatedReq", handleDelegatedReqStatus);
		socket.on("dispatchedReq", handleDispatchedReqStatus);
		socket.on("certificateMade", handleCertificateMade);

		return () => {
			socket.off("newRequest", addNewRequest);
			socket.off("signedReq", handleSignedReqStatus);
			socket.off("progressReq", handleSigningReqStatus);
			socket.off("rejectedReq", handleRejectedReqStatus);
			socket.off("delegatedReq", handleDelegatedReqStatus);
			socket.off("dispatchedReq", handleDispatchedReqStatus);
			socket.off("certificateMade", handleCertificateMade);
		};
	}, []);

	const handleCertificateMade = (reqId: string) => {
		setRequests(prev =>
			prev.map(req =>
				req.id === reqId
					? {
						...req,
						signedDocs: (req.signedDocs || 0) + 1
					}
					: req
			)
		);

		setFilteredRequests(prev =>
			prev.map(req =>
				req.id === reqId
					? {
						...req,
						signedDocs: (req.signedDocs || 0) + 1
					}
					: req
			)
		);
	};


	const handleDispatchedReqStatus = (reqId: string) => {
		setRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 7 } : req
			)
		)

		setFilteredRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 7 } : req
			)
		)
	}

	const handleDelegatedReqStatus = (reqId: string) => {
		setRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 3 } : req
			)
		)

		setFilteredRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 3 } : req
			)
		)
	}

	const handleRejectedReqStatus = (reqId: string) => {
		setRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 2 } : req
			)
		)

		setFilteredRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 2 } : req
			)
		)
	}

	const handleSignedReqStatus = (reqId: string) => {
		setRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 5 } : req
			)
		)

		setFilteredRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 5 } : req
			)
		);
	}

	const handleSigningReqStatus = (reqId: string) => {
		setRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 4 } : req
			)
		)

		setFilteredRequests((prev) =>
			prev.map((req) =>
				req.id === reqId ? { ...req, reqStatus: 4 } : req
			)
		);
	}

	const addNewRequest = (item: Request) => {
		const newRequest: Request = {
			userId: userId,
			id: item.id,
			key: item._id,
			createdAt: item.createdAt,
			title: item.description ?? "Untitled",
			officer: item.officer,
			totalDocs: item.totalDocs,
			rejectedDocs: item.rejectedDocs,
			reqStatus: item.signStatus ?? 0,
			assignedTo: item.assignedTo,
			createdBy: item.createdBy,
			delegatedTo: item.delegatedTo,
			_id: item._id,
			signedDocs: item.signedDocs ?? 0,
		};

		setRequests((prev) => [newRequest, ...prev]);
		setFilteredRequests((prev) => [newRequest, ...prev]);
	};

	const getOfficerList = async (currentUserId: string) => {
		try {
			const data = await courtClient.getOfficers();
			setOfficerList(
				data
					.filter(item => item.id !== currentUserId)
					.map(item => ({ label: item.name, value: item.id }))
			);
		} catch (error) {
			message.error("Failed to fetch officers");
		}
	};

	const fetchRequests = async () => {
		try {
			const response = await requestClient.getRequests();
			const formatted = response.map((item: any) => ({
				userId: item.userId,
				id: item.id,
				key: item._id,
				title: item.description,
				officer: item.officer,
				totalDocs: item.totalDocs || 0,
				rejectedDocs: item.rejectedDocs || 0,
				createdAt: item.createdAt,
				reqStatus: item.signStatus,
				assignedTo: item.assignedTo,
				createdBy: item.createdBy,
				delegatedTo: item.delegatedTo || null,
				signedDocs: item.signedDocs || 0,
			}));
			setRequests(formatted);
			setFilteredRequests(formatted);
		} catch (err) {
			message.error("Failed to fetch requests");
		}
	};

	const handleCreateRequest = async () => {
		try {
			const values = await form.validateFields();
			const formData = new FormData();
			formData.append("title", values.title);
			if (!uploadedFile) {
				message.error("Please upload a file before submitting.");
				return;
			}
			formData.append("template", uploadedFile);
			formData.append("totalDocs", "0");
			formData.append("rejectedDocs", "0");
			formData.append("reqStatus", "0");

			await requestClient.createNewRequest({ formData });
			message.success("Request created successfully!");
			form.resetFields();
			setIsDrawerOpen(false);
			fetchRequests();
		} catch (error) {
			message.error("Failed to create request");
		}
	};

	const handleDeleteRequest = async (id: string) => {
		try {
			await requestClient.deleteRequest(id);
			message.success("Request deleted");
			setRequests((prev) => prev.filter((r) => r.id !== id));
			setFilteredRequests((prev) => prev.filter((r) => r.id !== id));
		} catch (error) {
			console.log("error deleting the request : ", error);
			message.error("Failed to delete");
		}
	};

	const handleGetOtpReq = async () => {
		try {
			if (!selectedRequestId) return;
			setShowSignatureModal(false);
			setOtp('')
			otpForm.resetFields();
			await requestClient.getOtpReq(selectedRequestId);
			setShowOtpModal(true);
		} catch (error) {
			console.log("error in otp request : ", error);
		}
	}

	// const handleShowOtpModal = async () => {
	// 	setShowOtpModal(true);
	// 	setOtp('');
	// }

	const handleVerifyOtpRequest = async () => {
		try {
			const values = await otpForm.validateFields();
			const otpValue = values.otp;
			if (!selectedRequestId) return;
			setShowOtpModal(false);
			await requestClient.sendOtp({ reqId: selectedRequestId, otp: otpValue });
			setOtp('')
			handleSign();
		} catch (error) {
			console.log("error in otp request : ", error);
			message.error(`${error}`);
		}
	}

	const showRejectionForm = (reqId: string) => {
		setRejectionFormVisible(true);
		setRejectingRequest(reqId);
		setRejectionReason("");
	};

	const handleRejectReq = async (rejectionReason: string) => {
		try {
			await requestClient.rejectRequest({ rejectionReason, reqId: rejectingRequest });
			setRequests((prev) =>
				prev.map((req) =>
					req.id === rejectingRequest ? { ...req, reqStatus: 2 } : req
				)
			);

			setFilteredRequests((prev) =>
				prev.map((req) =>
					req.id === rejectingRequest ? { ...req, reqStatus: 2 } : req
				)
			);
			message.success("Request rejected");
		} catch (error) {
			message.error("Failed to reject the request");
		}
	}

	const handleDispatchReq = async (reqId: string) => {
		try {
			await requestClient.dispatchRequest(reqId);
			setRequests((prev) =>
				prev.map((req) =>
					req.id === reqId ? { ...req, reqStatus: 7 } : req
				)
			);

			setFilteredRequests((prev) =>
				prev.map((req) =>
					req.id === reqId ? { ...req, reqStatus: 7 } : req
				)
			);

			message.success("Request dispatched successfully");
		} catch (error) {
			message.error("Failed to dispatch the request");
		}
	}

	const handleTemplateReq = async (id: string) => {
		try {
			const pdfBuffer = await requestClient.getTemplate(id);
			const pdfUrl = URL.createObjectURL(pdfBuffer);
			window.open(pdfUrl, "_blank");
			setTimeout(() => {
				URL.revokeObjectURL(pdfUrl);
			}, 1000);
		} catch (error) {
			message.error("Failed to preview PDF.");
		}
	};

	const handleUpload = (file: File) => {
		setUploadedFile(file);
		setFileList([file]);
		return false;
	};

	const handleSearch = (value: string) => {
		setSearchTerm(value);
		const filtered = requests.filter((req) =>
			req.title.toLowerCase().includes(value.toLowerCase())
		);
		setFilteredRequests(filtered);
	};

	const handleAssignOfficer = async (officerId: string, requestId: string) => {
		try {
			await requestClient.signatureRequest({ officerId, requestId });
			message.success("Request sent successfully");
			setSelectedRequestId(null);
			fetchRequests();
		} catch (error) {
			console.error("Error sending request:", error);
			message.error("Failed to send request for signature");
		}
	};

	const fetchDelegatableOfficers = async (officerId: string, readerId: string) => {
		try {
			const response = await userClient.getDelegatableOfficers(officerId, readerId);

			const formatted = response.map((user: any) => ({
				label: user.name,
				value: user.id,
			}));

			setDelegatableUsers(formatted);
		} catch (error) {
			console.error("Failed to fetch delegatable officers:", error);
			message.error("Unable to load delegation options.");
		}
	};


	const handleDelegateRequest = async ({
		fromOfficerId,
		toOfficerId,
		requestId,
	}: {
		fromOfficerId: string;
		toOfficerId: string;
		requestId: string;
	}) => {
		try {
			await requestClient.delegateRequest({
				fromOfficerId,
				toOfficerId,
				requestId,
			});
			message.success("Request delegated successfully");
			setRequests((prev) =>
				prev.map((req) =>
					req.id === requestId
						? {
							...req,
							reqStatus: 3, // Delegated
							assignedTo: toOfficerId, // new officer
						}
						: req
				)
			);

			setFilteredRequests((prev) =>
				prev.map((req) =>
					req.id === requestId
						? {
							...req,
							reqStatus: 3,
							assignedTo: toOfficerId,
						}
						: req
				)
			);

			setSelectedDelegateRequestId(null);
			fetchRequests();
		} catch (error) {
			console.error("Error delegating request:", error);
			message.error("Failed to delegate request");
		}
	};

	const handleClone = async (reqId: string) => {
		try {
			await requestClient.cloneRequest(reqId);
			message.success("Request cloned successfully");
			fetchRequests();
		} catch (error) {
			console.log("error cloning the request : ", error);
			message.error("Failed to clone");
		}
	}

	const handlePrintAll = async (reqId: string) => {
		try {
			const pdfBlob = await requestClient.printAllDocs(reqId);

			const url = URL.createObjectURL(pdfBlob);
			const printWindow = window.open(url, "_blank");

			if (printWindow) {
				printWindow.onload = () => {
					printWindow.focus();
					printWindow.print();
				};
			} else {
				throw new Error("Unable to open print window");
			}
		} catch (error) {
			message.error("Failed to print all documents");
		}
	};

	const handleShowSignatureModal = async (reqId: string) => {
		try {
			setSelectedRequestId(reqId);
			const result = await requestClient.getSignatures(userId);
			setSignatures(result);
			setSelectedSignatureId(null);
			setShowSignatureModal(true);
		} catch (err) {
			message.error("Failed to fetch signatures");
		}
	};

	const handleSign = async () => {
		if (!selectedSignatureId || !selectedRequestId) return;
		try {
			await requestClient.signRequest({
				requestId: selectedRequestId,
				signatureId: selectedSignatureId,
				signedBy: userId
			});
			setShowSignatureModal(false);
			setSelectedSignatureId(null);
			fetchRequests();
		} catch (err) {
			message.error("Failed to sign request");
		}
	};

	const handleDownloadAll = async (reqId: string) => {
		try {
			const blob = await requestClient.downloadAllDocs(reqId);

			const url = window.URL.createObjectURL(new Blob([blob]));
			const link = document.createElement('a');
			link.href = url;

			link.setAttribute('download', `request_${reqId}_documents.zip`);
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			message.error("Failed to download all documents");
		}
	};

	const handleDispatchRegisterReq = async () => {
		try {
			if (!dispatchRegisterReqId) {
				message.error("Please select a request to register");
				return;
			}
			if (!dispatchRegisterNumber || dispatchRegisterNumber < 1) {
				message.error("Please enter a valid register number");
				return;
			}
			const result = await requestClient.dispatchRegister({ reqId: dispatchRegisterReqId, registerNumber: dispatchRegisterNumber });
			setDispatchRegisterReqId(null);
			setDispatchRegisterNumber(null);
		} catch (error) {
			console.log("error in dispatch register : ", error);
		}
	}

	const showDispatchRegister = async (reqId: string) => {
		try {
			setShowDispatchRegisterModal(true);
			setDispatchRegisterReqId(reqId);
			setDispatchRegisterNumber(null);
		} catch (error) {
			console.log("error in show dispatch register : ", error);
		}
	}

	const handleDispatchSlip = async (reqId: string) => {
		try {
			await requestClient.getDispatchSlip(reqId);
		} catch (error) {
			console.log("error in dispatch slip : ", error);
		}
	}

	const DocumentProgress: React.FC<DocumentProgressProps> = ({ signedDocs, totalDocs }) => {
		const percentage = Math.min((signedDocs / totalDocs) * 100, 100);

		return (
			<div
				style={{
					width: "80px",
					height: "5px",
					border: "1px solid black",
					backgroundColor: "white",
					position: "relative",
					borderRadius: "2px",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						width: `${percentage}%`,
						height: "100%",
						backgroundColor: "#1890ff",
						transition: "width 0.4s ease",
					}}
				/>
			</div>
		);
	};

	useEffect(() => {
		const runInit = async () => {
			await useAppStore.getState().init();
			const session = useAppStore.getState().session;

			if (!session?.userId || !session?.role) {
				message.error("Failed to fetch session data.");
				return;
			}

			setUserId(session.userId);
			setRole(session.role);

			fetchRequests();
			getOfficerList(session.userId);
		};

		runInit();
	}, []);

	const columns = [
		{
			title: "Title",
			dataIndex: "title",
			key: "title",
			render: (text: string, record: Request) => (
				<span
					style={{ color: "#1677ff", cursor: "pointer" }}
					onClick={() => handleTemplateReq(record.id)}
				>
					{text}
				</span>
			),
		},
		{
			title: "Total Docs",
			dataIndex: "totalDocs",
			key: "totalDocs",
			render: (text: number, record: Request) => (
				<span
					style={{ color: "#1677ff", cursor: "pointer" }}
					onClick={() => navigate(`/dashboard/request/${record.id}`)}
				>
					{text}
				</span>
			),
		},
		{
			title: "Rejected Docs",
			dataIndex: "rejectedDocs",
			key: "rejectedDocs",
			render: (text: number, record: Request) => (
				<span
					style={{ color: "#1677ff", cursor: "pointer" }}
					onClick={() => navigate(`/dashboard/rejectedReq/${record.id}`)}
				>
					{text}
				</span>
			)
		},
		// {
		// 	title: "Status",
		// 	dataIndex: "reqStatus",
		// 	key: "reqStatus",
		// 	render: (status: number, record: Request) => {
		// 		const statusMap: { [key: number]: { text: string; color: string } } = {
		// 			0: { text: "Unsigned", color: "gray" },
		// 			1: { text: "Read for Sign", color: "blue" },
		// 			2: { text: "Rejected", color: "red" },
		// 			3: { text: "Delegated", color: "purple" },
		// 			4: { text: "In Process", color: "orange" },
		// 			5: { text: "Signed", color: "green" },
		// 			6: { text: "Ready for Dispatch", color: "teal" },
		// 			7: { text: "Dispatched", color: "cyan" }
		// 		};
		// 		const { text, color } = statusMap[status] || { text: "Unknown", color: "default" };

		// 		return (
		// 			<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
		// 				<Tag color={color}>{text}</Tag>
		// 				{status === 4 && (
		// 					<DocumentProgress
		// 						signedDocs={record.signedDocs || 0}
		// 						totalDocs={record.totalDocs - record.rejectedDocs}
		// 					/>
		// 				)}
		// 			</div>
		// 		);
		// 	}
		// },
		// {
		// 	title: "Status",
		// 	dataIndex: "reqStatus",
		// 	key: "reqStatus",
		// 	render: (status: number) => {
		// 		const statusMap: { [key: number]: { text: string; color: string } } = {
		// 			0: { text: "Unsigned", color: "gray" },
		// 			1: { text: "Read for Sign", color: "blue" },
		// 			2: { text: "Rejected", color: "red" },
		// 			3: { text: "Delegated", color: "purple" },
		// 			4: { text: "In Process", color: "orange" },
		// 			5: { text: "Signed", color: "green" },
		// 			6: { text: "Ready for Dispatch", color: "teal" },
		// 			7: { text: "Dispatched", color: "cyan" }
		// 		};
		// 		const { text, color } = statusMap[status] || { text: "Unknown", color: "default" };

		// 		return <Tag color={color}>{text}</Tag>;
		// 	},
		// },
		// {
		// 	title: "Status",
		// 	dataIndex: "reqStatus",
		// 	key: "reqStatus",
		// 	render: (status: number, record: Request) => {
		// 		const statusMap: { [key: number]: { text: string; color: string } } = {
		// 			0: { text: "Unsigned", color: "gray" },
		// 			1: { text: "Read for Sign", color: "blue" },
		// 			2: { text: "Rejected", color: "red" },
		// 			3: { text: "Delegated", color: "purple" },
		// 			4: { text: "In Process", color: "orange" },
		// 			5: { text: "Signed", color: "green" },
		// 			6: { text: "Ready for Dispatch", color: "teal" },
		// 			7: { text: "Dispatched", color: "cyan" }
		// 		};

		// 		if (status === 4) {
		// 			const percentage = Math.min((record.signedDocs ?? 0) / (record.totalDocs - record.rejectedDocs) * 100, 100);
		// 			return (
		// 				<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
		// 					<Tag color={statusMap[4].color}>{statusMap[4].text}</Tag>
		// 					<div
		// 						style={{
		// 							width: "80px",
		// 							height: "5px",
		// 							border: "1px solid black",
		// 							backgroundColor: "white",
		// 							position: "relative",
		// 							borderRadius: "2px",
		// 							overflow: "hidden",
		// 						}}
		// 					>
		// 						<div
		// 							style={{
		// 								width: `${percentage}%`,
		// 								height: "100%",
		// 								backgroundColor: "#1890ff",
		// 								transition: "width 0.4s ease",
		// 							}}
		// 						/>
		// 					</div>
		// 				</div>
		// 			);
		// 		}

		// 		const { text, color } = statusMap[status] || { text: "Unknown", color: "default" };
		// 		return <Tag color={color}>{text}</Tag>;
		// 	}
		// },
		// {
		// 	title: "Status",
		// 	dataIndex: "reqStatus",
		// 	key: "reqStatus",
		// 	render: (text: any, record: Request) => {
		// 		if (record.reqStatus === 4) {
		// 			const percentage = Math.min((record.signedDocs || 0) / (record.totalDocs || 1) * 100, 100);

		// 			return (
		// 				<div style={{ width: 80 }}>
		// 					<div style={{ fontSize: 12, marginBottom: 4 }}>{`In Progress`}</div>
		// 					<div style={{
		// 						width: "100%",
		// 						height: 6,
		// 						backgroundColor: "#f0f0f0",
		// 						borderRadius: 4,
		// 						position: "relative"
		// 					}}>
		// 						<div
		// 							style={{
		// 								width: `${percentage}%`,
		// 								height: "100%",
		// 								backgroundColor: "#1890ff",
		// 								borderRadius: 4,
		// 								transition: "width 0.3s ease"
		// 							}}
		// 						/>
		// 					</div>
		// 					<div style={{ fontSize: 10, textAlign: "right" }}>{`${Math.round(percentage)}%`}</div>
		// 				</div>
		// 			);
		// 		}

		// 		const statusMap: Record<number, { text: string; color: string }> = {
		// 			0: { text: "Pending", color: "orange" },
		// 			1: { text: "Read for Sign", color: "blue" },
		// 			2: { text: "Rejected", color: "red" },
		// 			3: { text: "Delegated", color: "purple" },
		// 			5: { text: "Signed", color: "green" },
		// 			6: { text: "Completed", color: "cyan" },
		// 			7: { text: "Dispatched", color: "gold" },
		// 		};

		// 		const status = statusMap[record.reqStatus] || { text: "Unknown", color: "default" };

		// 		return <Tag color={status.color}>{status.text}</Tag>;
		// 	}
		// },
		{
	title: "Status",
	dataIndex: "reqStatus",
	key: "reqStatus",
	render: (text: any, record: Request) => {
		if (record.reqStatus === 4) {
			const percentage = Math.min((record.signedDocs || 0) / (record.totalDocs || 1) * 100, 100);

			return (
				<div style={{ width: 100 }}>
					<div
						style={{
							width: "100%",
							height: 15,
							backgroundColor: "#f0f0f0",
							border: "1px solid gray",
							borderRadius: 4,
							position: "relative",
							overflow: "hidden"
						}}
					>
						<div
							style={{
								width: `${percentage}%`,
								height: "100%",
								backgroundColor: "#1890ff",
								borderRadius: 4,
								transition: "width 0.3s ease"
							}}
						/>
					</div>
				</div>
			);
		}

		const statusMap: Record<number, { text: string; color: string }> = {
			0: { text: "Pending", color: "orange" },
			1: { text: "Read for Sign", color: "blue" },
			2: { text: "Rejected", color: "red" },
			3: { text: "Delegated", color: "purple" },
			5: { text: "Signed", color: "green" },
			6: { text: "Completed", color: "cyan" },
			7: { text: "Dispatched", color: "gold" },
		};

		const status = statusMap[record.reqStatus] || { text: "Unknown", color: "default" };

		return <Tag color={status.color}>{status.text}</Tag>;
	}
},
		{
			title: "Created At",
			dataIndex: "createdAt",
			key: "createdAt",
			render: (createdAt: string) =>
				new Date(createdAt).toLocaleString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					hour12: true,
				}),
		},
		{
			title: "Actions",
			key: "actions",

			render: (record: Request) => {
				const status = record.reqStatus;
				const reqId = record.id;

				const isAssignedToUser = record.assignedTo === userId;
				const isDelegatedToUser = record.delegatedTo === userId;

				if (status === 4) {
					return (
						<Flex justify="center" wrap="wrap" gap={6}>
							<Button
								disabled
								style={{
									minWidth: 120,
									backgroundColor: "gray",
									color: "white",
								}}
							>
								In Process
							</Button>

							{record.createdBy == userId && (
								<Button
									style={{ minWidth: 120 }}
									type="primary"
									onClick={() => handleClone(reqId)}
								>
									Clone
								</Button>
							)}

						</Flex>
					)
				}
				// Case 1: Assigned officer, but delegated to someone else
				else if (isAssignedToUser && record.delegatedTo && record.delegatedTo !== userId) {
					return (
						<Flex justify="center" wrap="wrap" gap={6}>
							<Button disabled ghost style={{ minWidth: 120 }}>
								Delegated
							</Button>
						</Flex>
					);
				}


				// Case 2: User is the delegate (can sign)
				else if (isDelegatedToUser) {
					if (record.createdBy !== userId) {
						return (
							<Flex justify="center" wrap="wrap" gap={6}>
								{(status === 3) && (
									<>
										<Button
											style={{ minWidth: 120 }}
											type="primary"
											// onClick={() =>
											// 	navigate("/dashboard/signatures", {
											// 		state: { requestId: reqId, userId },
											// 	})
											// }
											onClick={() => {
												handleShowSignatureModal(reqId);
											}}
										>
											Sign
										</Button>
										<Button
											danger
											style={{ minWidth: 120 }}
											onClick={() => showRejectionForm(reqId)}
										>
											Reject
										</Button>
									</>
								)}
								{(status === 5 || status === 7) && (
									<>
										<Button
											style={{ minWidth: 120 }}
											type="primary"
											onClick={() => handlePrintAll(reqId)}
										>
											Print
										</Button>
										<Button
											style={{ minWidth: 120 }}
											type="primary"
											onClick={() => handleDownloadAll(reqId)}
										>
											Download All
										</Button>
									</>
								)}
								{(status === 5) && (
									<Button
										style={{
											minWidth: 120,
											backgroundColor: "green",
											color: "white",
										}}
										onClick={() => handleDispatchReq(reqId)}
									>
										Dispatch
									</Button>
								)}
								{(status === 7) && (
									<>
										<Button
											style={{ minWidth: 120 }}
											type="primary"
											onClick={() => showDispatchRegister(reqId)}
										>
											Dispatch Register
										</Button>
										<Button
											style={{ minWidth: 120 }}
											type="primary"
											onClick={() => showDispatchRegister(reqId)}
										>
											Dispatch Slip
										</Button>
									</>
								)}
								{status === 2 && (
									<Button disabled danger style={{ minWidth: 120 }}>
										Rejected
									</Button>
								)}

							</Flex>
						)
					}
					return (
						<Flex justify="center" wrap="wrap" gap={6}>
							<Button
								style={{ minWidth: 120 }}
								type="primary"
								onClick={() => handleClone(reqId)}
							>
								Clone
							</Button>
							{(status === 3) && (
								<Button
									style={{ minWidth: 120 }}
									type="primary"
									onClick={() => {
										handleShowSignatureModal(reqId);
									}}
								>
									Sign
								</Button>
							)}
							{(status === 7 || status === 5) && (
								<>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => handlePrintAll(reqId)}
									>
										Print
									</Button>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => handleDownloadAll(reqId)}
									>
										Download All
									</Button>
								</>
							)}
							{(status === 7) && (
								<>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => showDispatchRegister(reqId)}
									>
										Dispatch Register
									</Button>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => handleDispatchSlip(reqId)}
									>
										Dispatch Slip
									</Button>
								</>
							)}
						</Flex>
					);
				}

				//  Case 3: Assigned officer and not delegated (can act)
				else if (isAssignedToUser && (!record.delegatedTo || record.delegatedTo === userId)) {
					return (
						<Flex justify="center" wrap="wrap" gap={6}>
							{/* {status === 3 && (
								<Button disabled ghost style={{ minWidth: 120 }}>
									Delegated
								</Button>
							)} */}
							{(status === 3) && (
								<Button
									style={{ minWidth: 120 }}
									type="primary"
									onClick={() => {
										handleShowSignatureModal(reqId);
									}}
								>
									Sign
								</Button>
							)}

							{status === 1 && (
								<>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => {
											handleShowSignatureModal(reqId);
										}}
									>
										Sign
									</Button>
									<Button
										danger
										style={{ minWidth: 120 }}
										onClick={() => showRejectionForm(reqId)}
									>
										Reject
									</Button>
									{selectedDelegateRequestId !== reqId && (
										<Button
											style={{ minWidth: 120 }}
											onClick={() => {
												fetchDelegatableOfficers(record.assignedTo, record.createdBy);
												setSelectedDelegateRequestId(reqId);
											}}
										>
											Delegate
										</Button>
									)}

									{selectedDelegateRequestId === reqId && (
										<Select
											style={{ minWidth: 180 }}
											placeholder="Select Officer"
											options={delegatableUsers}
											onChange={(toOfficerId) =>
												handleDelegateRequest({
													fromOfficerId: userId,
													toOfficerId,
													requestId: reqId,
												})
											}
											onBlur={() => setSelectedDelegateRequestId(null)}
											autoFocus
										/>
									)}

								</>
							)}

							{(status === 7 || status === 5) && (
								<>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => handlePrintAll(reqId)}
									>
										Print
									</Button>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => handleDownloadAll(reqId)}
									>
										Download All
									</Button>
								</>
							)}

							{status === 5 && (
								<Button
									style={{
										minWidth: 120,
										backgroundColor: "green",
										color: "white",
									}}
									onClick={() => handleDispatchReq(reqId)}
								>
									Dispatch
								</Button>
							)}

							{(status === 7) && (
								<>
									<Button
										type="primary"
										style={{ minWidth: 120 }}
										onClick={() => showDispatchRegister(reqId)}
									>
										Dispatch Register
									</Button>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() => handleDispatchSlip(reqId)}
									>
										Dispatch Slip
									</Button>
								</>
							)}

							{status === 2 && (
								<Button disabled danger style={{ minWidth: 120 }}>
									Rejected
								</Button>
							)}
						</Flex>
					);
				}

				//  Case 4: Everyone else (e.g., reader only)
				return (
					<Flex justify="center" wrap="wrap" gap={6}>
						<Button
							style={{ minWidth: 120 }}
							type="primary"
							onClick={() => handleClone(reqId)}
						>
							Clone
						</Button>

						{status === 0 && selectedRequestId !== record.id && (
							<Button
								style={{ minWidth: 120 }}
								type="primary"
								onClick={() => setSelectedRequestId(record.id)}
							>
								Request Sign
							</Button>
						)}

						{status === 0 && selectedRequestId === record.id && (
							<Select
								style={{ minWidth: 150 }}
								placeholder="Select Officer"
								options={officerList}
								onChange={(officerId) => handleAssignOfficer(officerId, reqId)}
								onBlur={() => setSelectedRequestId(null)}
								autoFocus
							/>
						)}

						{(status === 7 || status === 5) && (
							<>
								<Button
									style={{ minWidth: 120 }}
									type="primary"
									onClick={() => handlePrintAll(reqId)}
								>
									Print
								</Button>
								<Button
									style={{ minWidth: 120 }}
									type="primary"
									onClick={() => handleDownloadAll(reqId)}
								>
									Download All
								</Button>
							</>
						)}

						{(status === 7) && (
							<>
								<Button
									style={{ minWidth: 120 }}
									type="primary"
									onClick={() => showDispatchRegister(reqId)}
								>
									Dispatch Register
								</Button>
								<Button
									style={{ minWidth: 120 }}
									type="primary"
									onClick={() => handleDispatchSlip(reqId)}
								>
									Dispatch Slip
								</Button>
							</>
						)}

						{status === 5 && (
							<Button
								style={{
									minWidth: 120,
									backgroundColor: "green",
									color: "white",
								}}
								onClick={() => handleDispatchReq(reqId)}
							>
								Dispatch
							</Button>
						)}

						{status === 4 && (
							<Button
								disabled
								style={{
									minWidth: 120,
									backgroundColor: "gray",
									borderColor: "green",
									color: "white",
								}}
							>
								In Process
							</Button>
						)}

						{(status === 0) && (
							<Popconfirm
								title="Delete this request?"
								onConfirm={() => handleDeleteRequest(reqId)}
							>
								<Button danger style={{ minWidth: 120 }}>
									Delete
								</Button>
							</Popconfirm>
						)}

						{(status === 2) && (
							<Button disabled danger style={{ minWidth: 120 }}>
								Rejected
							</Button>
						)}
					</Flex>
				);
			}

		}

	];

	return (
		<MainAreaLayout
			title="Request Management"
			extra={
				<Flex gap={12}>
					<Input
						placeholder="Search by title"
						allowClear
						value={searchTerm}
						onChange={(e) => handleSearch(e.target.value)}
						style={{ width: 230, fontSize: "16px", padding: "4px 10px" }}
					/>
					<Button
						type="primary"
						onClick={() => setIsDrawerOpen(true)}
						style={{ width: 160 }}
					>
						Add Request
					</Button>
				</Flex>
			}
		>
			<CustomTable
				serialNumberConfig={{ name: "", show: true }}
				columns={columns}
				data={filteredRequests}
				loading={loading}
				onPageChange={(page) => setCurrentPage(page)}
			/>

			<Drawer
				title={currentRequest ? "Edit Request" : "Add Request"}
				placement="right"
				width={400}
				open={isDrawerOpen}
				onClose={() => {
					setIsDrawerOpen(false)
					setFileList([]);
					setUploadedFile(null);
				}
				}
			>
				<Form layout="vertical" form={form}>
					<Form.Item label="Title" name="title" rules={[{ required: true }]}>
						<Input placeholder="Enter title" />
					</Form.Item>

					<Form.Item label="Upload Template File">
						<Upload
							beforeUpload={handleUpload}
							fileList={fileList}
							onRemove={() => {
								setUploadedFile(null);
								setFileList([]);
							}}
							maxCount={1}
						>
							<Button icon={<UploadOutlined />}>Upload Docx</Button>
						</Upload>
					</Form.Item>

					<Button
						type="primary"
						block
						loading={loading}
						onClick={() =>
							// currentRequest ?
							// 	handleUpdateRequest(currentRequest.id) : 
							handleCreateRequest()
						}
					>
						{currentRequest ? "Update Request" : "Create Request"}
					</Button>
				</Form>
			</Drawer>

			<Modal
				open={showSignatureModal}
				title="Select Signature"
				onCancel={() => {
					setShowSignatureModal(false)
					setSelectedSignatureId(null);
				}
				}
				footer={null}
				width={800}
			>
				<Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
					<h3 style={{ margin: 0 }}></h3>
					<Button type="primary" onClick={() => navigate("/dashboard/signatures")}>+ Add Signature</Button>
				</Flex>

				<Row gutter={[16, 16]}>
					{signatures.map((sig: any) => (
						<Col key={sig.id} xs={24} sm={12} md={8}>
							<Card
								hoverable
								onClick={() => setSelectedSignatureId(sig.id)}
								style={{
									border: selectedSignatureId === sig.id ? "2px solid #1890ff" : undefined,
									textAlign: "center",
									cursor: "pointer",
								}}
								cover={
									<img
										alt="Signature"
										src={`${backendUrl}/${sig.url}`}
										style={{ height: 100, objectFit: "contain", padding: 10 }}
									/>
								}
							>
								{/* <Card.Meta title={item.name || "Unnamed Signature"} /> */}
							</Card>
						</Col>
					))}
				</Row>

				<Button
					type="primary"
					disabled={!selectedSignatureId}
					// onClick={handleSign}
					// onClick={handleShowOtpModal}
					onClick={handleGetOtpReq}
					style={{ marginTop: 24, width: "100%" }}
				>
					Sign
				</Button>
			</Modal>

			<Modal
				open={showOtpModal}
				title="Enter OTP"
				onCancel={() => {
					setShowOtpModal(false)
					setOtp('');
				}}
				footer={null}
				width={400}
			>

				<Form layout="vertical" form={otpForm}>
					<Form.Item label="OTP" name="otp" rules={[{ required: true }]}>
						<Input placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
					</Form.Item>
					<Button
						type="primary"
						loading={loading}
						disabled={!otp}
						onClick={handleVerifyOtpRequest}
						style={{ width: "100%" }}
					>
						Verify OTP
					</Button>
				</Form>


			</Modal>

			<Modal
				title="Reject Document"
				open={rejectionFormVisible}
				onCancel={() => {
					setRejectionFormVisible(false);
					setRejectionReason('');
					setRejectingRequest("");
				}}
				onOk={() => {
					handleRejectReq(rejectionReason)
					setRejectionFormVisible(false);
					setRejectionReason('');
					setRejectingRequest("");
				}}
				okButtonProps={{ disabled: !rejectionReason.trim() }}
				okText="Submit"
				cancelText="Cancel"
			>
				<Form layout="vertical" form={form}>
					<Form.Item label="Rejection Reason" required>
						<Input.TextArea
							rows={4}
							value={rejectionReason}
							onChange={(e) => setRejectionReason(e.target.value)}
							placeholder="Enter reason for rejection"
						/>
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title="Dispatch Register"
				open={showDispatchRegisterModal}
				onCancel={() => {
					setShowDispatchRegisterModal(false);
					setDispatchRegisterReqId("");
				}}
				onOk={() => {
					handleDispatchRegisterReq();
					setShowDispatchRegisterModal(false);
				}}
				okButtonProps={{ disabled: !dispatchRegisterReqId }}
				okText="Submit"
				cancelText="Cancel"
			>
				<Form layout="vertical" form={form}>
					<Form.Item label="Certificates dispatch number" required>
						<Input
							value={dispatchRegisterNumber ?? ""}
							onChange={(e) => {
								const value = e.target.value.trim();

								if (/^\d+$/.test(value)) {
									const number = parseInt(value, 10);
									if (number > 0) {
										setDispatchRegisterNumber(number);
									} else {
										setDispatchRegisterNumber(null);
									}
								} else {
									setDispatchRegisterNumber(null);
								}
							}}
							placeholder="Enter dispatch register number starting from"
						/>
					</Form.Item>
				</Form>
			</Modal>

		</MainAreaLayout>
	);
};

export default Requests;
