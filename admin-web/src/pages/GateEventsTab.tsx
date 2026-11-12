import React, { useState } from "react";
import { GateEvent } from "../types";
import { Camera, Check, Edit3, Filter, Image, Search, XCircle } from "lucide-react";
import { ImageLightbox } from "../components/CommonModals";
import { adminApi } from "../api/adminApi";

interface Props {
  events: GateEvent[];
  isLoading: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function GateEventsTab({ events, isLoading, onSuccess, onError }: Props) {
  const [filterDirection, setFilterDirection] = useState<"all" | "in" | "out">("all");
  const [filterDecision, setFilterDecision] = useState<"all" | "accepted" | "denied">("all");
  const [searchPlate, setSearchPlate] = useState("");

  // Lightbox xem ảnh
  const [lightboxEvent, setLightboxEvent] = useState<GateEvent | null>(null);

  // Modal sửa biển số
  const [editingEvent, setEditingEvent] = useState<GateEvent | null>(null);
  const [newPlateInput, setNewPlateInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredEvents = events.filter((ev) => {
    const dir = (ev.direction || "").toLowerCase();
    if (filterDirection !== "all" && dir !== filterDirection) return false;
    if (filterDecision !== "all" && ev.decision !== filterDecision) return false;
    if (searchPlate) {
      const q = searchPlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const plate = (ev.plateNormalized || ev.plateRaw || "").toUpperCase();
      if (!plate.includes(q)) return false;
    }
    return true;
  });

  const handleOpenEdit = (ev: GateEvent) => {
    setEditingEvent(ev);
    setNewPlateInput(ev.plateDisplay || ev.plateRaw || "");
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !newPlateInput.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await adminApi.correctPlate(editingEvent.id, newPlateInput.trim());
      onSuccess(
        `Đã đính chính biển số sự kiện ${editingEvent.id} thành ${newPlateInput.trim()}` +
          (res.sessionId ? ` (Phiên đỗ: #${res.sessionId.slice(-6)})` : "")
      );
      setEditingEvent(null);
    } catch (err: any) {
      onError(err.message || "Lỗi khi đính chính biển số.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header & Bộ lọc */}
      <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
            <span>Nhật Ký Sự Kiện Cổng (gateEvents)</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-mono">
              {filteredEvents.length} sự kiện
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Đối soát ảnh chụp camera AI tại cổng và kết quả nhận diện biển số OCR
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3">
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
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
          >
            <option value="all">Tất cả hướng</option>
            <option value="in">Cổng VÀO (IN)</option>
            <option value="out">Cổng RA (OUT)</option>
          </select>

          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
          >
            <option value="all">Tất cả quyết định</option>
            <option value="accepted">Hợp lệ (Accepted)</option>
            <option value="denied">Từ chối (Denied)</option>
          </select>
        </div>
      </div>

      {/* Bảng Sự Kiện */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Mã Sự Kiện</th>
              <th className="py-3.5 px-4">Hướng</th>
              <th className="py-3.5 px-4">Biển Số Nhận Diện</th>
              <th className="py-3.5 px-4">Độ Tin Cậy</th>
              <th className="py-3.5 px-4">Ô Gán</th>
              <th className="py-3.5 px-4">Độ Trễ</th>
              <th className="py-3.5 px-4">Quyết Định</th>
              <th className="py-3.5 px-4">Ảnh Chụp</th>
              <th className="py-3.5 px-4">Thời Gian</th>
              <th className="py-3.5 px-4">Hành Động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  Chưa có sự kiện cổng nào được ghi nhận.
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt) => {
                const dir = (evt.direction || "in").toLowerCase();
                const isAccepted = evt.decision === "accepted";
                const timeStr = evt.serverTs?.toDate
                  ? evt.serverTs.toDate().toLocaleTimeString("vi-VN")
                  : "-";

                return (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {evt.id.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-4 uppercase font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          dir === "in" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {dir.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          {evt.plateDisplay || evt.plateNormalized || evt.plateRaw || "CHƯA RÕ"}
                        </span>
                        {evt.isManualCorrected && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">
                            Đã sửa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {((evt.confidence || 0) * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">
                      {evt.assignedSlotId || "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {evt.latencyMs ? `${evt.latencyMs.toFixed(0)}ms` : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isAccepted
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isAccepted ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{isAccepted ? "Hợp lệ" : "Từ chối"}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {evt.imageUrl || evt.cropImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setLightboxEvent(evt)}
                          className="flex items-center space-x-1 text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 px-2 py-1 rounded transition"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Xem ảnh</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">Không có</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{timeStr}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(evt)}
                        className="flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded transition"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Sửa biển</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lightbox xem ảnh */}
      {lightboxEvent && (
        <ImageLightbox
          isOpen={!!lightboxEvent}
          imageUrl={lightboxEvent.imageUrl}
          cropUrl={lightboxEvent.cropImageUrl}
          title={`Ảnh sự kiện cổng: ${lightboxEvent.plateDisplay || lightboxEvent.plateRaw || lightboxEvent.id}`}
          onClose={() => setLightboxEvent(null)}
        />
      )}

      {/* Modal sửa biển số xe */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Đính Chính Biển Số Xe</h3>
            <p className="text-xs text-slate-500 mt-1">
              Sự kiện: <span className="font-mono font-bold">{editingEvent.id}</span> (Hướng{" "}
              {editingEvent.direction.toUpperCase()})
            </p>

            <form onSubmit={handleSubmitEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Biển số chính xác (Ví dụ: 51A-123.45 hoặc 29C1-999.88)
                </label>
                <input
                  type="text"
                  required
                  value={newPlateInput}
                  onChange={(e) => setNewPlateInput(e.target.value.toUpperCase())}
                  placeholder="51A-123.45"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditingEvent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition disabled:opacity-50"
                >
                  {isSubmitting ? "Đang lưu..." : "Xác nhận & Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

