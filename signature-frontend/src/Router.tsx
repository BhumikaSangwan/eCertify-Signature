import { Route, Navigate, Routes } from "react-router";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectRoute";
import Requests from "./pages/Requests.tsx";
import Signatures from "./pages/Signatures.tsx";
import { CourtManagement } from "./pages/CourtManagement.tsx";
import { CourtUsers } from "./pages/CourtUsers.tsx";
import RequestPage from "./pages/Request.tsx";
import RejectedReqPage from "./pages/RejectedReq.tsx";
import RedirectByRole from "./components/RedirectByRole/index.tsx";
import RoleProtectedRoute from "./components/RoleProtectedRoute.tsx/index.tsx";
import { roles } from "./libs/constants.ts";
import { Users } from "./pages/Users.tsx";
import CertificateDetails from "./pages/CertificateDetails"; 

export function Router() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/viewDetails/:id/:docId" element={<CertificateDetails />} />
			<Route path="/" element={<Dashboard />}>
				<Route path="" element={<Navigate to="/dashboard" />} />
				<Route path="/dashboard" element={<ProtectedRoute />}>
					<Route path="">
						<Route index element={<RedirectByRole />} />
						<Route
							element={
								<RoleProtectedRoute
									allowedRoles={[roles.officer, roles.reader]}
								/>
							}
						>
							<Route path="requests" element={<Requests />} />
							<Route
								path="request/:id"
								element={<RequestPage />}
							/>
							<Route 
								path="rejectedReq/:id"
								element={<RejectedReqPage />}
							/>
							<Route path="signatures" element={<Signatures />} />
							{/* <Route
								path="template/:id"
								element={<TemplatPreview />}
							/> */}
						</Route>

						<Route
							element={<RoleProtectedRoute allowedRoles={[roles.admin]} />}
						>
							<Route
								path="courts"
								element={<CourtManagement />}
							/>
							<Route path="users" element={<Users />} />
							<Route
								path="court/:courtId"
								element={<CourtUsers />}
							/>
						</Route>
					</Route>
				</Route>
			</Route>
		</Routes>
	);
}
