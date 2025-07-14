import React from "react";

interface DocumentProgressProps {
	signedDocs: number;
	totalDocs: number;
}

const DocumentProgress: React.FC<DocumentProgressProps> = ({ signedDocs, totalDocs }) => {
	const percentage = Math.min((signedDocs / totalDocs) * 100, 100);

	return (
		<div
			style={{
				width: "100px",
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

export default DocumentProgress;
