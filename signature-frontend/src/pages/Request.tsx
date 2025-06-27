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


interface RequestTableRow {
	[key: string]: any;
}

interface RequestDataItem {
	_id: string;
	data: Record<string, any>;
	signStatus: number;
}

export default function RequestPage() {
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [requests, setRequests] = useState<Request[]>([]);
	const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
	const [form] = Form.useForm();
	const [uploadedFile, setUploadedFile] = useState<File | null>(null);
	const [currentRequest, setCurrentRequest] = useState<Request | null>(null);
	const [tableColumns, setTableColumns] = useState<ColumnsType<RequestTableRow>>([]);
	const [tableData, setTableData] = useState<any[]>([]);
	const [, setCurrentPage] = useState<number>(1);
	const [requestName, setRequestName] = useState<string>("Document Management");
	const { id } = useParams<{ id: string }>();



	const fetchRequest = async (id: string) => {
		try {
			setLoading(true);
			const result = await requestClient.getRequest(id);
			setCurrentRequest(result);
			setRequestName(result.description || "Document Management");
			const dataArray = result.data || [];

			const dynamicKeysSet = new Set<string>();
			dataArray.forEach((item: any) => {
				Object.keys(item.data || {}).forEach((key) => {
					dynamicKeysSet.add(key);
				});
			});
			const dynamicKeys = Array.from(dynamicKeysSet);

			const dynamicColumns = dynamicKeys.map((key) => ({
				title: key,
				dataIndex: key,
				key: key,
			}));

			const fixedColumns = [
				// {
				// 	title: "Request Status",
				// 	dataIndex: "requestStatus",
				// 	key: "requestStatus",
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
				// 		const { text, color } = statusMap[status] || {
				// 			text: "Unknown",
				// 			color: "default",
				// 		};
				// 		return <Tag color={color}>{text}</Tag>;
				// 	},
				// },
				{
					title: "Preview",
					dataIndex: "preview",
					key: "preview",
				},
				{
					title: "Delete",
					dataIndex: "delete",
					key: "delete",
				},
			];

			const allColumns = [...dynamicColumns, ...fixedColumns];
			setTableColumns(allColumns);

			const formattedData = dataArray.map((item: RequestDataItem, index: number) => {
				return {
					key: index,
					_id: item._id,
					...item.data,
					requestStatus: result.signStatus,
					preview: (
						<Button type="link" onClick={() => showPreview(item)}>
							Preview
						</Button>
					),
					delete: (
						<Popconfirm
							title="Are you sure to delete this request?"
							onConfirm={() => deleteDocument(item)}
						>
							<Button type="link" danger>Delete</Button>
						</Popconfirm>
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

	async function showPreview(item: RequestDataItem) {
		try {
			const docId = item._id;
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

	async function deleteDocument(item: RequestDataItem) {
		try {
			const docId = item._id;
			if (!id) {
				message.error("Missing request ID");
				return;
			}
			await requestClient.deleteDoc({ docId, id });
			message.success("Document deleted successfully!");
			setTableData(prev => prev.filter((row) => row._id !== docId));
		} catch (error) {
			message.error("Failed to delete document");
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

	const handleUpdateRequest = async (id: string) => {

	};

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
					<Button
						type="primary"
						onClick={() => setIsDrawerOpen(true)}
						style={{ width: 160 }}
					>
						Upload File
					</Button>
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
		</MainAreaLayout>
	);
}
