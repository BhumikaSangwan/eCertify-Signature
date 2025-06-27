import React, { useEffect, useState } from "react";
import {
	Button,
	Card,
	Col,
	Drawer,
	Form,
	Input,
	Flex,
	Row,
	Upload,
	message,
	Typography,
	Divider,
	Space,
	Popconfirm
} from "antd";
import { useLocation } from "react-router-dom";
import {
	UploadOutlined,
	DeleteOutlined,
	CheckCircleTwoTone,
	PlusOutlined
} from "@ant-design/icons";
import MainAreaLayout from "../components/main-layout/main-layout";
import { useAppStore, requestClient } from "../store";
import styles from "./styles.module.css"

const { Title } = Typography;

interface Signature {
	id: string;
	url: string;
	name?: string;
	userId: string;
}


const Signatures: React.FC = () => {
	const location = useLocation();
	const { requestId } = location.state || {};

	const [signatureList, setSignatureList] = useState<Signature[]>([]);
	const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [form] = Form.useForm();
	const [fileList, setFileList] = useState<any[]>([]);
	const [userId, setUserId] = useState<string>("");

	useEffect(() => {
		const init = async () => {
			await useAppStore.getState().init(); // initialize session
			const session = useAppStore.getState().session;

			if (!session?.userId) {
				message.error("User session not found.");
				return;
			}

			setUserId(session.userId); // store userId in local state
			getSignatures(session.userId);

		};

		init();
	}, []);

	const getSignatures = async (userId: string) => {
		const signatures = await requestClient.getSignatures(userId);
		setSignatureList(signatures);
	}

	const handleUpload = (file: File) => {
		setFileList([file]);
		return false;
	};

	const handleAddSignature = async () => {
		if (fileList.length === 0) {
			message.error("Please upload a signature image.");
			return;
		}

		try {
			const rawFile = fileList[0]?.originFileObj || fileList[0];

			const formData = new FormData();
			formData.append("signature", rawFile);
			formData.append("userId", userId);
			formData.append("createdBy", userId);
			formData.append("updatedBy", userId);

			await requestClient.addNewSignature(formData);

			message.success("Signature added.");
			setIsDrawerOpen(false);
			form.resetFields();
			setFileList([]);

			getSignatures(userId);

		} catch (error) {
			message.error("Failed to upload signature.");
		}
	};

	const handleDeleteSignature = async (signatureId: string) => {
		try {
			await requestClient.deleteSignature(signatureId);
			message.success("Signature deleted.");
			getSignatures(userId);
		} catch (error) {
			console.error("Failed to delete signature:", error);
			message.error("Failed to delete signature.");
		}
	};


	const handleSign = async () => {
		if (!selectedSignatureId || !requestId) {
			message.error("Select a signature first.");
			return;
		}
		try {
			await requestClient.signRequest({ requestId, signatureId: selectedSignatureId, signedBy: userId });
			message.success("Documents signed successfully")
		} catch (error) {
			console.error("Failed to sign request:", error);
			message.error("Failed to sign request.");
			return;
		}
	};

	const renderSignatureCard = (sig: Signature) => (
		<Card
			key={sig.id}
			hoverable
			className={styles.customCard}
			onClick={() => requestId && setSelectedSignatureId(sig.id)}
			style={{
				border: selectedSignatureId === sig.id ? "2px solid #1890ff" : undefined,
				cursor: requestId ? "pointer" : "default"
			}}
			cover={
				<div className={styles.signatureImageWrapper}>
					<img
						src={`http://localhost:3000/${sig.url}`}
						alt="Signature"
						className={styles.signatureImage}
					/>
				</div>
			}
			actions={[
				<Popconfirm
					title="Delete this signature?"
					onConfirm={() => handleDeleteSignature(sig.id)}
				>
					<DeleteOutlined key="delete" style={{ color: "red" }} />
				</Popconfirm>,
				selectedSignatureId === sig.id && requestId ? (
					<CheckCircleTwoTone twoToneColor="#52c41a" key="selected" />
				) : null
			]}
		/>
	);

	return (

		<MainAreaLayout
			title="Signatures"
			extra={
				<Flex gap={12}>
					<Button
						type="primary"
						onClick={() => setIsDrawerOpen(true)}
						style={{ width: 160 }}
					>
						Add Signature
					</Button>
				</Flex>
			}
		>

			{/* Conditional Sign Form */}
			{requestId && (
				<div
					className={styles.signForm}
				>
					<Title level={4}>Choose a signature to sign the request</Title>
					<p>Click a signature card below to select. Then click "Sign".</p>
					<Button
						type="primary"
						disabled={!selectedSignatureId}
						onClick={handleSign}
						block
					>
						Sign Document
					</Button>
				</div>
			)}

			{/* Signature Gallery */}
			<Row gutter={[16, 16]}>
				{signatureList.map((sig) => (
					<Col key={sig.id} xs={24} sm={12} md={8}>
						{renderSignatureCard(sig)}
					</Col>
				))}
			</Row>

			{/* Drawer for Adding Signature */}
			<Drawer
				title="Add New Signature"
				open={isDrawerOpen}
				onClose={() => setIsDrawerOpen(false)}
				width={360}
			>
				<Form layout="vertical" form={form}>
					<Form.Item label="Upload Signature Image" required>
						<Upload
							beforeUpload={handleUpload}
							fileList={fileList}
							onRemove={() => setFileList([])}
							accept="image/*"
							maxCount={1}
						>
							<Button icon={<UploadOutlined />}>Upload Image</Button>
						</Upload>
					</Form.Item>

					<Button type="primary" block onClick={handleAddSignature}>
						Submit Signature
					</Button>
				</Form>
			</Drawer>
		</MainAreaLayout>

	)
};

export default Signatures;
