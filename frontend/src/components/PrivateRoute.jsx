import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { isAuth, ready } = useAuth();
  if (!ready) return null;
  if (!isAuth) return <Navigate to="/login" replace />;
  return children;
}
