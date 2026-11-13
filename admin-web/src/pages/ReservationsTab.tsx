import React, { useState } from "react";
import { Lot, Reservation, Slot } from "../types";
import { Ban, CalendarCheck, PlusCircle, RotateCcw, Search } from "lucide-react";
import { adminApi } from "../api/adminApi";

interface Props {
  reservations: Reservation[];
  lot: Lot | null;
  slots: Slot[];
  isLoading: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ReservationsTab({ reservations, lot, slots, onSuccess, onError }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchPlate, setSearchPlate] = useState<string>("");

  // Form Admin tạo đặt chỗ mới
  const [plateInput, setPlateInput] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [holdMinutes, setHoldMinutes] = useState<number>(15);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Modal hủy giữ chỗ
  const [cancellingRes, setCancellingRes] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("Quản trị viên hủy giữ chỗ trên Web Admin");
  const [isCancelling, setIsCancelling] = useState(false);

  // Modal hoàn cọc
  const [refundingRes, setRefundingRes] = useState<Reservation | null>(null);
  const [refundReason, setRefundReason] = useState("Quản trị viên duyệt hoàn tiền cọc do sự cố kỹ thuật");
  const [isRefunding, setIsRefunding] = useState(false);

  const availableSlots = slots.filter((s) => s.status === "available" && !s.sensorOccupied);

  const filtered = reservations.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (searchPlate) {
      const q = searchPlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const plate = (r.plate || "").toUpperCase();
      if (!plate.includes(q)) return false;
    }
    return true;
  });

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = plateInput.trim();
    if (!trimmed) {
      onError("Vui lòng nhập biển số xe cần đặt chỗ.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await adminApi.createReservation({
        plateDisplay: trimmed,
        lotId: lot?.id || "lot_live_01",
        slotId: selectedSlotId || undefined,
        holdMinutes,
      });
      onSuccess(
        `Đã đặt chỗ cho xe ${res.plateDisplay} — Hệ thống đã gán ô ${res.slotId} (giữ trong ${holdMinutes} phút).`
      );
      setPlateInput("");
      setSelectedSlotId("");
    } catch (err: any) {
      onError(err.message || "Lỗi khi tạo lượt đặt chỗ.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingRes) return;

    setIsCancelling(true);
    try {
      const res = await adminApi.cancelReservation(cancellingRes.id, cancelReason);
      onSuccess(
        `Đã hủy giữ chỗ cho xe ${cancellingRes.plateDisplay || cancellingRes.plate}, giải phóng ô ${res.slotId || cancellingRes.slotId}` +
          (res.refundedAmount > 0 ? ` (đã hoàn cọc ${res.refundedAmount.toLocaleString("vi-VN")}đ).` : ".")
      );
      setCancellingRes(null);
    } catch (err: any) {
      onError(err.message || "Lỗi khi hủy giữ chỗ.");
    } finally {
      setIsCancelling(false);
    }
  };

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
    <div className="space-y-6">
      {/* Form Admin Tạo Đặt Chỗ & Hệ Thống Gán Ô */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
              <PlusCircle className="w-5 h-5 text-emerald-600" />
              <span>Tạo Đặt Chỗ Nhanh (Admin Gán Chỗ Theo Biển Số)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Nhập biển số xe — hệ thống tự động chọn ô trống khả dụng (hoặc chọn ô cụ thể) và khóa chỗ ngay khi xe chưa vào
            </p>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              availableSlots.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            Còn {availableSlots.length}/{slots.length || 4} ô trống
          </span>
        </div>

        <form onSubmit={handleCreateReservation} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Biển Số Xe <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={plateInput}
              onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
              placeholder="VD: 18Y-444.44 hoặc 30A12345"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Gán Ô Đỗ
            </label>
            <select
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Tự động gán ô trống đầu tiên</option>
              {slots.map((s) => {
                const isFree = s.status === "available" && !s.sensorOccupied;
                return (
                  <option key={s.id} value={s.id} disabled={!isFree}>
                    Ô {s.id} — {isFree ? "Trống (Khả dụng)" : s.sensorOccupied ? "Có xe" : s.status === "reserved" ? "Đã giữ chỗ" : "Đang đỗ"}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Thời Gian Giữ
            </label>
            <select
              value={holdMinutes}
              onChange={(e) => setHoldMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={15}>15 phút</option>
              <option value={30}>30 phút</option>
              <option value={60}>60 phút (1 giờ)</option>
              <option value={120}>120 phút (2 giờ)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isCreating || availableSlots.length === 0 || !plateInput.trim()}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isCreating ? "Đang gán ô..." : "Đặt chỗ & Gán ô"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Bảng Danh Sách Đặt Chỗ */}
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
              Theo dõi thời hạn giữ chỗ, ô đã gán, tiền cọc và hủy/hoàn cọc khi cần
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm biển số..."
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-36 uppercase font-mono"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang giữ chỗ (Active)</option>
              <option value="fulfilled">Đã vào bãi (Fulfilled)</option>
              <option value="expired">Quá hạn (Expired)</option>
              <option value="cancelled">Đã hủy (Cancelled)</option>
            </select>
          </div>
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
                      {(r.depositAmount ?? 0).toLocaleString("vi-VN")}đ
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
                            : r.depositStatus === "none"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.depositStatus === "applied"
                          ? "Đã đối trừ"
                          : r.depositStatus === "refunded"
                          ? "Đã hoàn cọc"
                          : r.depositStatus === "forfeited"
                          ? "Đã tịch thu"
                          : r.depositStatus === "none"
                          ? "Admin (Không cọc)"
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
                      {r.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => setCancellingRes(r)}
                          className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition flex items-center space-x-1"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Hủy giữ chỗ</span>
                        </button>
                      ) : isForfeited ? (
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

      {/* Modal hủy giữ chỗ */}
      {cancellingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Hủy Giữ Chỗ & Giải Phóng Ô</h3>
            <p className="text-xs text-slate-500 mt-1">
              Biển số: <span className="font-mono font-bold text-slate-800">{cancellingRes.plateDisplay || cancellingRes.plate}</span> • Ô đang giữ:{" "}
              <span className="font-bold text-emerald-600">{cancellingRes.slotId}</span>
            </p>

            <form onSubmit={handleConfirmCancel} className="mt-5 space-y-4">
              {cancellingRes.depositAmount > 0 && cancellingRes.depositStatus === "held" && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                  Khách đã cọc{" "}
                  <strong>{cancellingRes.depositAmount.toLocaleString("vi-VN")}đ</strong> — hệ thống sẽ tự động hoàn cọc về ví khi hủy.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Lý do hủy giữ chỗ
                </label>
                <input
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setCancellingRes(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow transition disabled:opacity-50"
                >
                  {isCancelling ? "Đang hủy..." : "Xác nhận hủy giữ chỗ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

