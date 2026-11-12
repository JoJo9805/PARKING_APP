import React, { useState } from "react";
import { Session } from "../types";
import { Car, CheckCircle2, Clock, DoorClosed, Eye, Search } from "lucide-react";
import { ImageLightbox } from "../components/CommonModals";
import { adminApi } from "../api/adminApi";

interface Props {
  sessions: Session[];
  isLoading: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function SessionsTab({ sessions, isLoading, onSuccess, onError }: Props) {
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed">("all");
  const [searchPlate, setSearchPlate] = useState("");

  const [closingSession, setClosingSession] = useState<Session | null>(null);
  const [waiveFee, setWaiveFee] = useState(false);
  const [closeReason, setCloseReason] = useState("Quản trị viên đóng phiên thủ công tại Web");
  const [isClosing, setIsClosing] = useState(false);

  // Lightbox
  const [lightboxSession, setLightboxSession] = useState<Session | null>(null);

  const filteredSessions = sessions.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (searchPlate) {
      const q = searchPlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const plate = (s.plate || "").toUpperCase();
      if (!plate.includes(q)) return false;
    }
    return true;
  });

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingSession) return;

    setIsClosing(true);
    try {
      const res = await adminApi.closeSession({
        sessionId: closingSession.id,
        waiveFee,
        closeReason,
      });

      onSuccess(
        `Đã đóng phiên đỗ cho xe ${closingSession.plateDisplay || closingSession.plate}. ` +
          `Phí: ${res.fee.toLocaleString("vi-VN")}đ, Thu thêm: ${res.amountCharged.toLocaleString("vi-VN")}đ, Hoàn cọc: ${res.depositRefund.toLocaleString("vi-VN")}đ.`
      );
      setClosingSession(null);
    } catch (err: any) {
      onError(err.message || "Lỗi khi đóng phiên đỗ xe.");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header & Filter */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
            <Car className="w-5 h-5 text-emerald-600" />
            <span>Quản Lý Phiên Đỗ Xe (sessions)</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-mono">
              {filteredSessions.length} phiên
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi chi tiết thời gian đỗ, tính cước block và quản lý thu phí đối trừ cọc
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
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang đỗ (Active)</option>
            <option value="completed">Đã kết thúc (Completed)</option>
          </select>
        </div>
      </div>

      {/* Danh sách phiên đỗ */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Mã Phiên</th>
              <th className="py-3.5 px-4">Biển Số</th>
              <th className="py-3.5 px-4">Vị Trí</th>
              <th className="py-3.5 px-4">Giờ Vào</th>
              <th className="py-3.5 px-4">Giờ Ra</th>
              <th className="py-3.5 px-4">Thời Gian</th>
              <th className="py-3.5 px-4">Phí Gốc</th>
              <th className="py-3.5 px-4">Trừ Cọc</th>
              <th className="py-3.5 px-4">Thực Thu</th>
              <th className="py-3.5 px-4">Trạng Thái</th>
              <th className="py-3.5 px-4">Hành Động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400">
                  Không có phiên đỗ xe nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredSessions.map((s) => {
                const isActive = s.status === "active";
                const entryStr = s.entryTime?.toDate
                  ? s.entryTime.toDate().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                  : "-";
                const exitStr = s.exitTime?.toDate
                  ? s.exitTime.toDate().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                  : "-";

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {s.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                      {s.plateDisplay || s.plate}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">
                      {s.actualSlotId || s.assignedSlotId || "A1"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{entryStr}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{exitStr}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {s.durationMin !== undefined ? `${s.durationMin} phút` : "Đang đếm"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {s.fee !== undefined ? `${s.fee.toLocaleString("vi-VN")}đ` : "-"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {s.depositApplied ? `-${s.depositApplied.toLocaleString("vi-VN")}đ` : "-"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                      {s.amountCharged !== undefined ? `${s.amountCharged.toLocaleString("vi-VN")}đ` : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isActive ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isActive ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{isActive ? "Đang đỗ" : "Đã xong"}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 flex items-center space-x-2">
                      {(s.entryImageUrl || s.exitImageUrl) && (
                        <button
                          type="button"
                          onClick={() => setLightboxSession(s)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                          title="Xem ảnh camera"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setClosingSession(s);
                            setWaiveFee(false);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition flex items-center space-x-1"
                        >
                          <DoorClosed className="w-3 h-3" />
                          <span>Đóng phiên</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lightbox ảnh phiên đỗ */}
      {lightboxSession && (
        <ImageLightbox
          isOpen={!!lightboxSession}
          imageUrl={lightboxSession.entryImageUrl || lightboxSession.exitImageUrl}
          title={`Ảnh phiên đỗ xe: ${lightboxSession.plateDisplay || lightboxSession.plate}`}
          onClose={() => setLightboxSession(null)}
        />
      )}

      {/* Modal đóng phiên thủ công */}
      {closingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Đóng Phiên Đỗ Xe Thủ Công</h3>
            <p className="text-xs text-slate-500 mt-1">
              Xe: <span className="font-mono font-bold text-slate-800">{closingSession.plateDisplay || closingSession.plate}</span>{" "}
              (Vị trí {closingSession.actualSlotId || closingSession.assignedSlotId})
            </p>

            <form onSubmit={handleConfirmClose} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Lý do đóng phiên
                </label>
                <input
                  type="text"
                  required
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Lý do..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="waiveFeeCheck"
                  checked={waiveFee}
                  onChange={(e) => setWaiveFee(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="waiveFeeCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Miễn phí cước đỗ xe (Thu 0đ & hoàn toàn bộ tiền cọc)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isClosing}
                  onClick={() => setClosingSession(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isClosing}
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow transition disabled:opacity-50"
                >
                  {isClosing ? "Đang xử lý..." : "Xác nhận đóng phiên"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

