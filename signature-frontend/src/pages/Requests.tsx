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
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import CustomTable from "../components/CustomTable";
import MainAreaLayout from "../components/main-layout/main-layout";
import { courtClient, useAppStore, requestClient, userClient } from "../store";
import { useNavigate } from "react-router-dom";

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
	delegatedTo?: string | null;
}

const Requests: React.FC = () => {
	const [requests, setRequests] = useState<Request[]>([]);
	const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [form] = Form.useForm();
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


	const navigate = useNavigate();

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
				id: item._id,
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

	const handleRejectReq = async (reqId: string) => {
		try {
			await requestClient.rejectRequest(reqId);
			setRequests((prev) =>
				prev.map((req) =>
					req.id === reqId ? { ...req, reqStatus: 2 } : req
				)
			);

			setFilteredRequests((prev) =>
				prev.map((req) =>
					req.id === reqId ? { ...req, reqStatus: 2 } : req
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

	// const handleUpdateRequest = async (id: string) => {
	// 	try {
	// 		const values = await form.validateFields();
	// 		await requestClient.updateRequest(id, values);
	// 		message.success("Request updated");
	// 		setIsDrawerOpen(false);
	// 		form.resetFields();
	// 		setCurrentRequest(null);
	// 		fetchRequests();
	// 	} catch (error) {
	// 		message.error("Update failed");
	// 	}
	// };

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

	// const getDelegatableOfficers = async (OfficerId: string, requestId: string) => {
	// 	try {
	// 		await requestClient.getDelegatableOfficers(OfficerId, requestId);
	// 		setSelectedRequestId(null);
	// 		fetchRequests();
	// 	} catch (error) {
	// 		console.error("Error fetching delegatable officers:", error);
	// 		message.error("Failed to fetch delegatable officers");
	// 	}
	// }

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

	// const handleDelegateRequest = async (officerId: string, requestId: string) => {
	// 	try {
	// 		await requestClient.delegateRequest({ officerId, requestId });
	// 		message.success("Request delegated successfully");
	// 		setSelectedDelegateRequestId(null);
	// 		fetchRequests();
	// 	} catch (error) {
	// 		console.error("Error delegating request:", error);
	// 		message.error("Failed to delegate request");
	// 	}
	// };


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
		{ title: "Rejected Docs", dataIndex: "rejectedDocs", key: "rejectedDocs" },
		{
			title: "Status",
			dataIndex: "reqStatus",
			key: "reqStatus",
			render: (status: number) => {
				const statusMap: { [key: number]: { text: string; color: string } } = {
					0: { text: "Unsigned", color: "gray" },
					1: { text: "Read for Sign", color: "blue" },
					2: { text: "Rejected", color: "red" },
					3: { text: "Delegated", color: "purple" },
					4: { text: "In Process", color: "orange" },
					5: { text: "Signed", color: "green" },
					6: { text: "Ready for Dispatch", color: "teal" },
					7: { text: "Dispatched", color: "cyan" }
				};
				const { text, color } = statusMap[status] || { text: "Unknown", color: "default" };

				return <Tag color={color}>{text}</Tag>;
			},
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

				// Case 1: Assigned officer, but delegated to someone else
				if (isAssignedToUser && record.delegatedTo && record.delegatedTo !== userId) {
					return (
						<Flex justify="center" wrap="wrap" gap={6}>
							<Button disabled ghost style={{ minWidth: 120 }}>
								Delegated
							</Button>
						</Flex>
					);
				}


				// Case 2: User is the delegate (can sign)
				if (isDelegatedToUser) {
					if (record.createdBy !== userId) {
						return (
							<Flex justify="center" wrap="wrap" gap={6}>
								{(status === 3) && (
									<>
										<Button
											style={{ minWidth: 120 }}
											type="primary"
											onClick={() =>
												navigate("/dashboard/signatures", {
													state: { requestId: reqId, userId },
												})
											}
										>
											Sign
										</Button>
										<Button
											danger
											style={{ minWidth: 120 }}
											onClick={() => handleRejectReq(reqId)}
										>
											Reject
										</Button>
									</>
								)}
								{(status === 5) && (
									<Button
										style={{
											minWidth: 120,
											backgroundColor: "green",
											borderColor: "green",
											color: "white",
										}}
										onClick={() => handleDispatchReq(reqId)}
									>
										Dispatch
									</Button>
								)}
								{(status === 7) && (
									<Button disabled ghost style={{ minWidth: 120 }}>
										Dispatched
									</Button>
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
									onClick={() =>
										navigate("/dashboard/signatures", {
											state: { requestId: reqId, userId },
										})
									}
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
						</Flex>
					);
				}

				// ✅ Case 3: Assigned officer and not delegated (can act)
				if (isAssignedToUser && (!record.delegatedTo || record.delegatedTo === userId)) {
					return (
						<Flex justify="center" wrap="wrap" gap={6}>
							{status === 3 && (
								<Button disabled ghost style={{ minWidth: 120 }}>
									Delegated
								</Button>
							)}

							{status === 1 && (
								<>
									<Button
										style={{ minWidth: 120 }}
										type="primary"
										onClick={() =>
											navigate("/dashboard/signatures", {
												state: { requestId: reqId, userId },
											})
										}
									>
										Sign
									</Button>
									<Button
										danger
										style={{ minWidth: 120 }}
										onClick={() => handleRejectReq(reqId)}
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

							{status === 5 && (
								<Button
									style={{
										minWidth: 120,
										backgroundColor: "green",
										borderColor: "green",
										color: "white",
									}}
									onClick={() => handleDispatchReq(reqId)}
								>
									Dispatch
								</Button>
							)}

							{status === 7 && (
								<Button disabled ghost style={{ minWidth: 120 }}>
									Dispatched
								</Button>
							)}

							{status === 2 && (
								<Button disabled danger style={{ minWidth: 120 }}>
									Rejected
								</Button>
							)}
						</Flex>
					);
				}

				// ✅ Case 4: Everyone else (e.g., reader only)
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

						{(status === 7 ) && (
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

						{(status === 0 || status === 2) && (
							<Popconfirm
								title="Delete this request?"
								onConfirm={() => handleDeleteRequest(reqId)}
							>
								<Button danger style={{ minWidth: 120 }}>
									Delete
								</Button>
							</Popconfirm>
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
				onClose={() => setIsDrawerOpen(false)}
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
							currentRequest
								? handleUpdateRequest(currentRequest.id)
								: handleCreateRequest()
						}
					>
						{currentRequest ? "Update Request" : "Create Request"}
					</Button>
				</Form>
			</Drawer>
		</MainAreaLayout>
	);
};

export default Requests;
