import React, { useState } from "react";
import { Reservation } from "../types";
import { CalendarCheck, Check, Clock, RotateCcw, Search, XCircle } from "lucide-react";
import { adminApi } from "../api/adminApi";

interface Props {
  reservations: Reservation[];
  isLoading: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ReservationsTab({ reservations, isLoading, onSuccess, onError }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [refundingRes, setRefundingRes] = useState<Reservation | null>(null);
  const [refundReason, setRefundReason] = useState("Quản trị viên duyệt hoàn tiền cọc do sự cố kỹ thuật");
  const [isRefunding, setIsRefunding] = useState(false);

  const filtered = reservations.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingRes) return;

    setIsRefunding(true);
    try {
      const res = await adminApi.refundDeposit(refundingRes.id, refundReason);
      onSuccess(
        `Đã duyệt hoàn tiền cọc ${refundingRes.depositAmount.toLocaleString("vi-VN")}đ cho lượt đặt chỗ ${refundingRes.id.slice(-6)} (Số dư mới: ${res.balanceAfter.toLocaleString("vi-VN")}đ).`
      );
      setRefundingRes(null);
    } catch (err: any) {
      onError(err.message || "Lỗi khi hoàn tiền cọc.");
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-emerald-600" />
            <span>Quản Lý Đặt Chỗ & Đối Trừ Cọc (reservations)</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-mono">
              {filtered.length} lượt
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi thời hạn giữ chỗ 15 phút, tiền cọc 5.000đ và phê duyệt hoàn cọc quá hạn
          </p>
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang giữ chỗ (Active)</option>
          <option value="fulfilled">Đã vào bãi (Fulfilled)</option>
          <option value="expired">Quá hạn 15p (Expired)</option>
          <option value="cancelled">Đã hủy (Cancelled)</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Mã Đặt Chỗ</th>
              <th className="py-3.5 px-4">Biển Số Xe</th>
              <th className="py-3.5 px-4">Ô Giữ</th>
              <th className="py-3.5 px-4">Tiền Cọc</th>
              <th className="py-3.5 px-4">Trạng Thái Cọc</th>
              <th className="py-3.5 px-4">Thời Gian Đặt</th>
              <th className="py-3.5 px-4">Hết Hạn Lúc</th>
              <th className="py-3.5 px-4">Trạng Thái</th>
              <th className="py-3.5 px-4">Hành Động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Không có lượt đặt chỗ nào.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isForfeited = r.depositStatus === "forfeited";
                const createdStr = r.createdAt?.toDate
                  ? r.createdAt.toDate().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                  : "-";
                const expiresStr = r.expiresAt?.toDate
                  ? r.expiresAt.toDate().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                  : "-";

                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {r.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                      {r.plateDisplay || r.plate}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">{r.slotId}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {(r.depositAmount || 5000).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          r.depositStatus === "applied"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.depositStatus === "refunded"
                            ? "bg-purple-100 text-purple-800"
                            : r.depositStatus === "forfeited"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.depositStatus === "applied"
                          ? "Đã đối trừ"
                          : r.depositStatus === "refunded"
                          ? "Đã hoàn cọc"
                          : r.depositStatus === "forfeited"
                          ? "Đã tịch thu"
                          : "Đang giữ cọc"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{createdStr}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{expiresStr}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          r.status === "active"
                            ? "bg-blue-100 text-blue-800"
                            : r.status === "fulfilled"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "cancelled"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {r.status === "active"
                          ? "Đang giữ"
                          : r.status === "fulfilled"
                          ? "Đã vào bãi"
                          : r.status === "cancelled"
                          ? "Đã hủy"
                          : "Hết hạn"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isForfeited ? (
                        <button
                          type="button"
                          onClick={() => setRefundingRes(r)}
                          className="px-2.5 py-1 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Hoàn cọc</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal hoàn cọc thủ công */}
      {refundingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Duyệt Hoàn Tiền Cọc Thủ Công</h3>
            <p className="text-xs text-slate-500 mt-1">
              Lượt cọc: <span className="font-mono font-bold text-slate-800">{refundingRes.id}</span> • Xe:{" "}
              <span className="font-mono font-bold">{refundingRes.plateDisplay || refundingRes.plate}</span>
            </p>

            <form onSubmit={handleConfirmRefund} className="mt-5 space-y-4">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-xs">
                Số tiền sẽ hoàn lại vào ví khách hàng:{" "}
                <strong className="text-base text-purple-700 font-bold">
                  {(refundingRes.depositAmount || 5000).toLocaleString("vi-VN")}đ
                </strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Lý do hoàn cọc (Bắt buộc)
                </label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Nhập lý do..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isRefunding}
                  onClick={() => setRefundingRes(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isRefunding}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow transition disabled:opacity-50"
                >
                  {isRefunding ? "Đang xử lý..." : "Xác nhận hoàn cọc"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

