import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { OpsAuthProvider, useOpsAuth } from './OpsAuthContext.jsx';
import OpsLogin from './OpsLogin.jsx';
import OpsLayout from './OpsLayout.jsx';
import OpsHome from './OpsHome.jsx';
import OpsOrders from './OpsOrders.jsx';
import OpsOrderDetail from './OpsOrderDetail.jsx';
import OpsDeliveryNote from './OpsDeliveryNote.jsx';
import OpsWorkers from './OpsWorkers.jsx';
import OpsReports from './OpsReports.jsx';

function Splash() {
  return (
    <div className="splash">
      <div className="spinner" />
      <span>Cargando operaciones…</span>
    </div>
  );
}

function OpsProtected() {
  const { user, loading } = useOpsAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/operaciones/login" replace />;
  return <Outlet />;
}

function OpsSoloJefe() {
  const { user, loading } = useOpsAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/operaciones/login" replace />;
  if (user.rol !== 'jefe') return <Navigate to="/operaciones" replace />;
  return <Outlet />;
}

function OpsLoginRoute() {
  const { user, loading } = useOpsAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/operaciones" replace />;
  return <OpsLogin />;
}

export default function OperationsApp() {
  return (
    <OpsAuthProvider>
      <Routes>
        <Route path="/operaciones/login" element={<OpsLoginRoute />} />
        <Route element={<OpsProtected />}>
          <Route element={<OpsLayout />}>
            <Route path="/operaciones" element={<OpsHome />} />
            <Route path="/operaciones/pedidos" element={<OpsOrders />} />
            <Route path="/operaciones/pedidos/:id" element={<OpsOrderDetail />} />
            <Route element={<OpsSoloJefe />}>
              <Route
                path="/operaciones/pedidos/:id/nota"
                element={<OpsDeliveryNote />}
              />
              <Route path="/operaciones/operarios" element={<OpsWorkers />} />
              <Route path="/operaciones/reportes" element={<OpsReports />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/operaciones" replace />} />
      </Routes>
    </OpsAuthProvider>
  );
}
