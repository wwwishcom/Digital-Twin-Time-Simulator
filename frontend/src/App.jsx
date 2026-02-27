import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import CalendarPage from "./pages/CalendarPage";
import HubPage from "./pages/HubPage";
import EditPage from "./pages/EditPage";
import GoalPage from "./pages/GoalPage";
import TwinLabPage from "./pages/TwinLabPage";
import TwinWalletPage from "./pages/TwinWalletPage";
import LogInputPage from "./pages/LogInputPage";
import GoalTwinPage from "./pages/GoalTwinPage";
import SelfCareTwinPage from "./pages/SelfCareTwinPage";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
      <Route path="/hub" element={<PrivateRoute><HubPage /></PrivateRoute>} />
      <Route path="/edit" element={<PrivateRoute><EditPage /></PrivateRoute>} />
      <Route path="/goals" element={<PrivateRoute><GoalPage /></PrivateRoute>} />
      <Route path="/life-hub" element={<Navigate to="/twin-lab" replace />} />
      <Route path="/twin-lab" element={<PrivateRoute><TwinLabPage /></PrivateRoute>} />
      <Route path="/twin-wallet" element={<PrivateRoute><TwinWalletPage /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute><LogInputPage /></PrivateRoute>} />
      <Route path="/goal-twin" element={<PrivateRoute><GoalTwinPage /></PrivateRoute>} />
      <Route path="/self-care-twin" element={<PrivateRoute><SelfCareTwinPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}