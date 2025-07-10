import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CustomTable from "../components/CustomTable";
import MainAreaLayout from "../components/main-layout/main-layout";
import { requestClient } from "../store";
import type { ColumnsType } from 'antd/es/table';



interface RequestTableRow {
    [key: string]: any;
}

interface RequestDataItem {
    id: string;
    data: Record<string, any>;
    signStatus: number;
    rejectionReason: string
}

export default function RejectedReqPage() {

    const [loading, setLoading] = useState(false);
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
            console.log("rejected req : ", result);
            setCurrentRequest(result);
            setRequestName(result.description || "Document Management");
            const dataArray = result.data || [];
            const filteredData = dataArray.filter((item: any) => item.signStatus === 2);

            const dynamicKeysSet = new Set<string>();
            filteredData.forEach((item: any) => {
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
                {
                    title: 'Rejection Reason',
                    dataIndex: 'rejectionReason',
                    key: 'rejectionReason',
                },
            ];

            const allColumns = [...dynamicColumns, ...fixedColumns];
            setTableColumns(allColumns);

            const formattedData = filteredData.map((item: RequestDataItem, index: number) => {
                const data = {
                    key: index,
                    id: item.id,
                    ...item.data,
                    requestStatus: result.signStatus,
                    rejectionReason: item.rejectionReason
                };
                return { ...data, }
            });

            setTableData(formattedData);
        } catch (error) {
            console.error("Failed to fetch request:", error);
        } finally {
            setLoading(false);
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
        >
            <CustomTable
                serialNumberConfig={{ name: "S. No.", show: true }}
                columns={tableColumns}
                data={tableData}
                loading={loading}
                onPageChange={(page) => setCurrentPage(page)}
            />


        </MainAreaLayout>
    );
}
