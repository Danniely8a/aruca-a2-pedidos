import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Customers from './pages/Customers.jsx';
import OrderBuilder from './pages/OrderBuilder.jsx';
import OrderHistory from './pages/OrderHistory.jsx';
import OrderDetail from './pages/OrderDetail.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <div className="spinner" />
        <span>Cargando plataforma…</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/productos" element={<Products />} />
        <Route path="/clientes" element={<Customers />} />
        <Route path="/pedido" element={<OrderBuilder />} />
        <Route path="/pedidos" element={<OrderHistory />} />
        <Route path="/pedidos/:id" element={<OrderDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
