import React, { useState } from "react";
import { UserAccount } from "../types";
import { AlertCircle, DollarSign, PlusCircle, Search, Users, Wallet } from "lucide-react";
import { adminApi } from "../api/adminApi";

interface Props {
  users: UserAccount[];
  isLoading: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function UsersTab({ users, isLoading, onSuccess, onError }: Props) {
  const [search, setSearch] = useState("");
  const [adjustingUser, setAdjustingUser] = useState<UserAccount | null>(null);
  const [deltaAmount, setDeltaAmount] = useState<number>(50000);
  const [adjustType, setAdjustType] = useState<"plus" | "minus">("plus");
  const [adjustReason, setAdjustReason] = useState("Quản trị viên nạp tiền hỗ trợ khách hàng");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.displayName || "").toLowerCase().includes(q) ||
      (u.uid || "").toLowerCase().includes(q)
    );
  });

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingUser) return;

    const amount = adjustType === "plus" ? Math.abs(deltaAmount) : -Math.abs(deltaAmount);
    if (!amount) return;

    setIsSubmitting(true);
    try {
      const res = await adminApi.adjustBalance(adjustingUser.uid, amount, adjustReason);
      onSuccess(
        `Đã điều chỉnh ${amount > 0 ? "+" : ""}${amount.toLocaleString("vi-VN")}đ cho người dùng ${
          adjustingUser.displayName || adjustingUser.email
        }. Số dư mới: ${res.balanceAfter.toLocaleString("vi-VN")}đ.`
      );
      setAdjustingUser(null);
    } catch (err: any) {
      onError(err.message || "Lỗi khi điều chỉnh số dư ví.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Người Dùng & Quản Lý Ví (users)</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-mono">
              {filtered.length} tài khoản
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu số dư ví nội bộ, theo dõi tài khoản âm tiền và điều chỉnh số dư thủ công
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo email, tên, UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56 text-slate-700"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">UID</th>
              <th className="py-3.5 px-4">Họ & Tên</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4">Số Dư Ví</th>
              <th className="py-3.5 px-4">Xe Mặc Định</th>
              <th className="py-3.5 px-4">Ngày Tạo</th>
              <th className="py-3.5 px-4">Hành Động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Không tìm thấy người dùng nào.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const balance = Number(u.walletBalance || 0);
                const isNegative = balance < 0;
                const createdStr = u.createdAt?.toDate
                  ? u.createdAt.toDate().toLocaleDateString("vi-VN")
                  : "-";

                return (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {u.uid.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {u.displayName || "Chưa đặt tên"}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg ${
                          isNegative
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {balance.toLocaleString("vi-VN")}đ
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {u.defaultVehicleId || "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{createdStr}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingUser(u);
                          setDeltaAmount(50000);
                          setAdjustType("plus");
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition flex items-center space-x-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Chỉnh ví</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal điều chỉnh số dư */}
      {adjustingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Điều Chỉnh Số Dư Ví Người Dùng</h3>
            <p className="text-xs text-slate-500 mt-1">
              Khách hàng: <strong className="text-slate-800">{adjustingUser.displayName || adjustingUser.email}</strong> (Số
              dư hiện tại: {Number(adjustingUser.walletBalance || 0).toLocaleString("vi-VN")}đ)
            </p>

            <form onSubmit={handleConfirmAdjust} className="mt-5 space-y-4">
              <div className="flex rounded-xl overflow-hidden border border-slate-200 p-1 bg-slate-50 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAdjustType("plus")}
                  className={`flex-1 py-2 rounded-lg transition ${
                    adjustType === "plus" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  + Cộng Tiền (Nạp/Hoàn)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("minus")}
                  className={`flex-1 py-2 rounded-lg transition ${
                    adjustType === "minus" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  - Trừ Tiền (Thu hồi)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Số tiền cần điều chỉnh (VND)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={deltaAmount}
                  onChange={(e) => setDeltaAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Lý do điều chỉnh (Bắt buộc)
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ví dụ: Nạp hỗ trợ, đối soát sự cố..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setAdjustingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition disabled:opacity-50"
                >
                  {isSubmitting ? "Đang xử lý..." : "Xác nhận điều chỉnh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

