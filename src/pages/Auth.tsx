import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const Auth = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <AuthForm />;
};

export default Auth;
