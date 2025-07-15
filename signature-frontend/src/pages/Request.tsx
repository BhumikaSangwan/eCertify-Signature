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
import { useParams } from "react-router-dom";
import CustomTable from "../components/CustomTable";
import MainAreaLayout from "../components/main-layout/main-layout";
import { requestClient } from "../store";
import type { ColumnsType } from 'antd/es/table';
import { Modal } from "antd";
import { useAppStore } from "../store";



interface RequestTableRow {
	[key: string]: any;
}

interface RequestDataItem {
	id: string;
	data: Record<string, any>;
	signStatus: number;
}

export default function RequestPage() {
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [form] = Form.useForm();
	const [uploadedFile, setUploadedFile] = useState<File | null>(null);
	const [currentRequest, setCurrentRequest] = useState<Request | null>(null);
	const [tableColumns, setTableColumns] = useState<ColumnsType<RequestTableRow>>([]);
	const [tableData, setTableData] = useState<any[]>([]);
	const [, setCurrentPage] = useState<number>(1);
	const [requestName, setRequestName] = useState<string>("Document Management");
	const { id } = useParams<{ id: string }>();
	const [rejectionFormVisible, setRejectionFormVisible] = useState(false);
	const [rejectionReason, setRejectionReason] = useState('');
	const [rejectingItem, setRejectingItem] = useState<RequestDataItem | null>(null);
	const [userId, setUserId] = useState<string>('');
	const [createdBy, setCreatedBy] = useState<string>('');
	const [signStatus, setSignStatus] = useState<number>(0);

	useEffect(() => {
		const runInit = async () => {
			await useAppStore.getState().init();
			const session = useAppStore.getState().session;

			if (!session?.userId || !session?.role) {
				message.error("Failed to fetch session data.");
				return;
			}

			setUserId(session.userId);
		};

		runInit();
	}, []);

	const fetchRequest = async (id: string) => {
		try {
			setLoading(true);
			const result = await requestClient.getRequest(id);
			setCurrentRequest(result);
			setRequestName(result.description || "Document Management");
			setCreatedBy(result.createdBy);
			setSignStatus(result.signStatus)
			const dataArray = result.data || [];

			const dynamicKeysSet = new Set<string>();
			dataArray.forEach((item: any) => {
				Object.keys(item.data || {}).forEach((key) => {
					dynamicKeysSet.add(key);
				});
			});
			const dynamicKeys = Array.from(dynamicKeysSet);

			const dynamicColumns: ColumnsType<RequestTableRow> = dynamicKeys.map((key) => ({
				title: key,
				dataIndex: key,
				key: key,
			}));

			const requestSignStatus = result.signStatus;

			const fixedColumns: ColumnsType<RequestTableRow> = [
				{
					title: "Preview",
					key: "preview",
					dataIndex: "preview",
				},
				{
					title: "Actions",
					key: "actions",
					render: (_: any, record: RequestTableRow) => {
						const isDisabled = ![0, 1, 2].includes(requestSignStatus);

						return (
							<Flex>
								<Popconfirm
									title="Are you sure to delete this request?"
									onConfirm={() => deleteDocument(record)}
								>
									<Button
										danger
										style={{ marginRight: "10px" }}
										disabled={isDisabled}
									>
										Delete
									</Button>
								</Popconfirm>
								{requestSignStatus !== 2 && (
									<Button
										onClick={() => showRejectionForm(record)}
										disabled={isDisabled}
									>
										Reject
									</Button>
								)}
							</Flex>
						);
					},
				},
			];

			const allColumns: ColumnsType<RequestTableRow> = [...dynamicColumns, ...fixedColumns];
			setTableColumns(allColumns);

			const formattedData = dataArray.map((item: RequestDataItem, index: number) => {
				return {
					key: index,
					id: item.id,
					...item.data,
					requestStatus: result.signStatus,
					preview: (
						<Flex>
							{item.signStatus != 2 && <Button onClick={() => showPreview(item)}>Preview</Button>}
							{item.signStatus == 2 && <Tag color="red" style={{ padding: "5px 15px" }}>Rejected</Tag>}
						</Flex>
					),
					action: (
						<Flex>
							<Popconfirm
								title="Are you sure to delete this request?"
								onConfirm={() => deleteDocument(item)}
							>
								<Button danger
									style={{ marginRight: "10px" }}
									disabled={![0, 1, 2].includes(signStatus)}
								>
									Delete
								</Button>
							</Popconfirm>
							{
								item.signStatus != 2 &&
								<Button
									onClick={() => showRejectionForm(item)}
									disabled={![0, 1, 2].includes(signStatus)}
								>
									Reject
								</Button>
							}

						</Flex>
					),
				};
			});

			setTableData(formattedData);
		} catch (error) {
			console.error("Failed to fetch request:", error);
		} finally {
			setLoading(false);
		}
	};

	async function showPreview(item: RequestTableRow) {
		try {
			const docId = item.id;
			if (!id) {
				message.error("Missing request ID");
				return;
			}
			const pdfBlob = await requestClient.getPreview({ docId, id });

			const pdfUrl = URL.createObjectURL(pdfBlob);

			window.open(pdfUrl, '_blank');

			setTimeout(() => {
				URL.revokeObjectURL(pdfUrl);
			}, 1000);

		} catch (error) {
			message.error("Failed to preview PDF.");
		}
	}

	async function deleteDocument(item: RequestTableRow) {
		try {
			const docId = item.id;
			if (!id) {
				message.error("Missing request ID");
				return;
			}
			await requestClient.deleteDoc({ docId, id });
			message.success("Document deleted successfully!");
			setTableData(prev => prev.filter((row) => row.id !== docId));
		} catch (error) {
			message.error("Failed to delete document");
		}
	}

	async function showRejectionForm(item: RequestTableRow) {
		setRejectionFormVisible(true);
		setRejectingItem(item);
		setRejectionReason('');
	}

	async function handleRejectDoc() {
		if (!rejectionReason.trim()) return;

		if (!id || !rejectingItem) {
			message.error("Missing necessary information.");
			return;
		}

		try {
			const response = await requestClient.rejectDoc({
				docId: rejectingItem.id,
				reqId: id,
				// userId: rejectingItem.userId,
				reason: rejectionReason,
			});

			message.success("Document rejected successfully!");

			setTableData(prev => prev.map(row => {
				if (row.id === rejectingItem.id) {
					return {
						...row,
						preview: <Tag color="red" style={{ padding: "5px 15px" }}>Rejected</Tag>,
						action: <Button danger style={{ marginRight: "10px" }}>Delete</Button>
					};
				}
				return row;
			}));

			setRejectionFormVisible(false);
			setRejectionReason('');
			setRejectingItem(null);
		} catch (error) {
			message.error("Failed to reject document.");
		}
	}


	const handleUpload = (file: File) => {
		setUploadedFile(file);
		return false;
	};

	const handleDownloadTemplate = async () => {
		try {
			if (!id) {
				message.error("Missing request ID");
				return;
			}
			const excelBuffer = await requestClient.downloadExcelTemplate(id);
			const blob = new Blob([excelBuffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});

			const url = window.URL.createObjectURL(blob);

			const link = document.createElement("a");
			link.href = url;
			link.setAttribute("download", "template.xlsx");
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.log("Error downloading the template", error);
		}
	}

	const handleCreateRequest = async () => {
		let result;
		try {
			await form.validateFields();
			const formData = new FormData();
			if (!uploadedFile) {
				message.error("Please upload a file before submitting.");
				return;
			}
			formData.append("excel", uploadedFile);
			if (!id) {
				message.error("Missing request ID");
				return;
			}
			formData.append("reqId", id);

			result = await requestClient.uploadExcelData({ formData });

			// message.success("File uploaded successfully!");  
			message.success(result.message);
			form.resetFields();
			setUploadedFile(null);
			setIsDrawerOpen(false);
			if (id) {
				fetchRequest(id);
			}

		} catch (error: any) {
			let errorMessage = "Failed to upload the file";
			if (error.response && error.response.data && error.response.data.message) {
				errorMessage = error.response.data.message;
			}
			message.error(errorMessage);
		}
	};

	useEffect(() => {
		if (id) {
			fetchRequest(id);
		}
	}, [id]);

	return (
		<MainAreaLayout
			title={requestName}
			extra={
				<Flex gap={12}>
					{userId == createdBy && signStatus == 0 &&
						<Button
							type="primary"
							onClick={() => setIsDrawerOpen(true)}
							style={{ width: 160 }}
						>
							Upload File
						</Button>
					}
					<Button
						type="primary"
						onClick={() => handleDownloadTemplate()}
						style={{ width: 180 }}
					>
						Download Format Template
					</Button>
				</Flex>
			}
		>
			<CustomTable
				serialNumberConfig={{ name: "S. No.", show: true }}
				columns={tableColumns}
				data={tableData}
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
					<Form.Item label="Upload Excel File">
						<Upload beforeUpload={handleUpload} maxCount={1}>
							<Button icon={<UploadOutlined />}>Upload Excel File</Button>
						</Upload>
					</Form.Item>

					<Button
						type="primary"
						block
						loading={loading}
						onClick={() => handleCreateRequest()}
					>
						Create Request
					</Button>
				</Form>
			</Drawer>
			<Modal
				title="Reject Document"
				open={rejectionFormVisible}
				onCancel={() => {
					setRejectionFormVisible(false);
					setRejectionReason('');
					setRejectingItem(null);
				}}
				onOk={handleRejectDoc}
				okButtonProps={{ disabled: !rejectionReason.trim() }}
				okText="Submit"
				cancelText="Cancel"
			>
				<Form layout="vertical">
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

		</MainAreaLayout>
	);
}
