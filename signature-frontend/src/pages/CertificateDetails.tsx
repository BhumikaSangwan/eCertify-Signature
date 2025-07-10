import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Modal, Descriptions, Spin, message } from "antd";
import { requestClient } from "../store";

const CertificateDetails: React.FC = () => {
	const { id, docId } = useParams();
	const [details, setDetails] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [showMeta, setShowMeta] = useState(false);
	const cleanDocId = docId?.split(".")[0];

	useEffect(() => {
		if (!id || !docId) {
			message.error("Missing certificate ID or document ID.");
			return;
		}

		setLoading(false);
	}, [id, docId]);

	const handleShowMeta = async () => {
		try {
			const res = await requestClient.getDocData({ docId: cleanDocId, id });
			console.log("res : ", res.result);
			setDetails(res.result);
			setShowMeta(true);
		} catch (error) {
			console.log(error);
		}
	}


	const handleShowDoc = async () => {
		try {
			const pdfBlob = await requestClient.getPreview({ docId: cleanDocId, id });
			const pdfUrl = URL.createObjectURL(pdfBlob);

			window.open(pdfUrl, '_blank');

			setTimeout(() => {
				URL.revokeObjectURL(pdfUrl);
			}, 1000);
		} catch (error) {
			console.error(error);
		}
	}

	if (loading) return <Spin size="large" style={{ marginTop: 100 }} />;

	return (
		<div style={{ textAlign: "center", padding: 40 }}>
			<h2>Certificate Verification</h2>
			<p>Use the buttons below to view the certificate or its details.</p>

			<Button type="primary" style={{ margin: 10 }} onClick={handleShowDoc}>
				View Certificate
			</Button>
			<Button style={{ margin: 10 }} onClick={handleShowMeta}>
				View Details
			</Button>

			<Modal
				open={showMeta}
				title="Certificate Details"
				onCancel={() => setShowMeta(false)}
				footer={null}
			>
				<Descriptions bordered column={1}>
					<Descriptions.Item label="Signed By">{details?.signedBy}</Descriptions.Item>
					<Descriptions.Item label="Signed At">{new Date(details?.signedDate).toLocaleString()}</Descriptions.Item>
					<Descriptions.Item label="Request ID">{details?.id}</Descriptions.Item>
					<Descriptions.Item label="Signature ID">{details?.signatureId}</Descriptions.Item>
				</Descriptions>
			</Modal>
		</div>
	);
};

export default CertificateDetails;
