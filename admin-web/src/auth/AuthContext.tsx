import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../firebase";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const tokenRes = await currentUser.getIdTokenResult(true);
          const hasAdmin = tokenRes.claims.admin === true;
          setIsAdmin(hasAdmin);
          if (!hasAdmin) {
            setError("Tài khoản không có quyền Admin (thiếu custom claim admin: true).");
          } else {
            setError(null);
          }
        } catch (err: any) {
          console.error("Lỗi khi kiểm tra token claims:", err);
          setIsAdmin(false);
          setError("Không thể xác thực quyền quản trị viên.");
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const tokenRes = await cred.user.getIdTokenResult(true);
      if (tokenRes.claims.admin !== true) {
        setIsAdmin(false);
        setError("Tài khoản này không có quyền quản trị viên (admin: true).");
        await firebaseSignOut(auth);
      } else {
        setIsAdmin(true);
      }
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Email hoặc mật khẩu không chính xác.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Quá nhiều lần thử thất bại. Vui lòng thử lại sau ít phút.");
      } else {
        setError(err.message || "Đăng nhập thất bại.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setIsAdmin(false);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        signIn,
        signOut,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

