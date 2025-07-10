import React, { useEffect, useState } from "react";
import {
	Button,
	Drawer,
	Form,
	Flex,
	Upload,
	message,
	Typography,
	Col,
	Row,
	Card,
	Popconfirm
} from "antd";
import { UploadOutlined, DeleteOutlined } from "@ant-design/icons";
import MainAreaLayout from "../components/main-layout/main-layout";
import { useAppStore, requestClient } from "../store";
import styles from "./styles.module.css"


interface Signature {
	id: string;
	url: string;
	name?: string;
	userId: string;
}


const Signatures: React.FC = () => {
	const [signatureList, setSignatureList] = useState<Signature[]>([]);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [form] = Form.useForm();
	const [fileList, setFileList] = useState<any[]>([]);
	const [userId, setUserId] = useState<string>("");

	useEffect(() => {
		const init = async () => {
			await useAppStore.getState().init();
			const session = useAppStore.getState().session;

			if (!session?.userId) {
				message.error("User session not found.");
				return;
			}

			setUserId(session.userId);
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
			<div>
				<Row gutter={[16, 16]}>
					{/* {signatureList.map((sig: any) => (
						<Col key={sig.id} xs={24} sm={12} md={8}>
							<Card
								hoverable
								cover={
									<img
										alt="Signature"
										src={`http://localhost:3000/${sig.url}`}
										style={{ height: 100, objectFit: "contain", padding: 10 }}
									/>
								}
							>
								<hr style={{ margin: "0 0 10px" }} />
								<div style={{ display: "flex", justifyContent: "center" }}>
									<DeleteOutlined
										style={{ color: "red", fontSize: 20, cursor: "pointer" }}
										onClick={() => handleDeleteSignature(sig.id)} // Replace with your actual delete logic
									/>
								</div>
							</Card>
						</Col>
					))} */}
					{signatureList.map((sig: any) => (
  <Col key={sig.id} xs={24} sm={12} md={8}>
    <Card
      hoverable
      bodyStyle={{ padding: 0 }} // Remove default body padding
      cover={
        <img
          alt="Signature"
          src={`http://localhost:3000/${sig.url}`}
          style={{
            height: 160,
            objectFit: "contain",
            padding: 10,
            width: "100%",
          }}
        />
      }
    >
      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e0e0e0", // Light gray
          margin: 0,
        }}
      />
      <div
        style={{
          height: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Popconfirm
          title="Delete this signature?"
          description="Are you sure you want to delete this signature?"
          onConfirm={() => handleDeleteSignature(sig.id)}
          okText="Yes"
          cancelText="No"
        >
          <DeleteOutlined
            style={{
              color: "red",
              fontSize: 20,
              cursor: "pointer",
            }}
          />
        </Popconfirm>
      </div>
    </Card>
  </Col>
))}
				</Row>
			</div>
		</MainAreaLayout>

	)
};

export default Signatures;
