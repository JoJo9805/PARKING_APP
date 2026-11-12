import React from "react";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { Loader2 } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
        <p className="text-slate-400 text-sm font-medium">Đang tải bảng điều khiển...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

