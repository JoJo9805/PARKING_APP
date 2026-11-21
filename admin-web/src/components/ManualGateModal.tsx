import React, { useEffect, useRef, useState } from "react";
import { GateEvent, Session } from "../types";
import { AlertTriangle, Camera, Car, CheckCircle2, DoorOpen, RefreshCw, Search, X } from "lucide-react";
import { adminApi } from "../api/adminApi";

interface Props {
  event: GateEvent | null;
  activeSessions: Session[];
  pendingCount?: number;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function normalizePlate(plate?: string | null): string {
  return (plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function ManualGateModal({
  event,
  activeSessions,
  pendingCount = 0,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const [plateInput, setPlateInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewCropUrl, setPreviewCropUrl] = useState("");
  const [recaptureMsg, setRecaptureMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [isRecapturing, setIsRecapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeSessionsRef = useRef(activeSessions);
  activeSessionsRef.current = activeSessions;
  const autoRecapturedIdsRef = useRef<Set<string>>(new Set());

  const dir: "in" | "out" =
    (event?.direction || "in").toLowerCase() === "out" ? "out" : "in";
  const isPendingManual = Boolean(
    event &&
      (event.status === "pending_manual" ||
        (event.status === "pending" && !event.plateNormalized))
  );
  const isNotInLot = Boolean(
    event &&
      dir === "out" &&
      (event.denyReason === "PLATE_NOT_IN_LOT" ||
        (event.flags || []).includes("plate_not_in_lot") ||
        (event.denyReason || "").includes("Không tìm thấy phiên đỗ"))
  );

  useEffect(() => {
    if (!event) return;
    setPlateInput(event.plateDisplay || event.plateRaw || "");
    setSelectedSessionId("");
    setSessionSearch("");
    setPreviewImageUrl(event.imageUrl || "");
    setPreviewCropUrl(event.cropImageUrl || "");
    setRecaptureMsg(null);
    setActionError(null);
  }, [event?.id]);

  // Đồng bộ URL ảnh nếu background recapture từ Edge vừa cập nhật lên gateEvent
  useEffect(() => {
    if (!event) return;
    if (event.imageUrl && !previewImageUrl) setPreviewImageUrl(event.imageUrl);
    if (event.cropImageUrl && !previewCropUrl) setPreviewCropUrl(event.cropImageUrl);
  }, [event?.imageUrl, event?.cropImageUrl]);

  const runRecapture = async (
    targetEventId: string,
    targetDir: "in" | "out",
    targetIsPending: boolean,
    isAuto: boolean,
    isCancelled?: () => boolean
  ) => {
    setIsRecapturing(true);
    setRecaptureMsg(null);
    try {
      const res = await adminApi.recaptureGate(targetEventId, targetDir);
      if (isCancelled?.()) return;

      if (res.imageUrl) setPreviewImageUrl(res.imageUrl);
      if (res.cropImageUrl) setPreviewCropUrl(res.cropImageUrl);

      if (res.isValid && res.plateDisplay) {
        if (targetDir === "out") {
          const normRes = normalizePlate(res.plateNormalized || res.plateDisplay);
          const matched = activeSessionsRef.current.find(
            (s) => normalizePlate(s.plate) === normRes
          );
          if (matched) {
            setSelectedSessionId(matched.id);
            setPlateInput(matched.plateDisplay || res.plateDisplay);
            setRecaptureMsg({
              ok: true,
              text: `${isAuto ? "Tự động chụp lại" : "Chụp lại"} khớp xe đang trong bãi: ${matched.plateDisplay || res.plateDisplay} (${Math.round((res.confidence || 0) * 100)}%)${matched.exitRequested ? " • Đã gửi yêu cầu ra" : ""}. Bấm Xác nhận để tính phí & mở Cổng RA.`,
            });
          } else {
            setSelectedSessionId("");
            setPlateInput(res.plateDisplay);
            setRecaptureMsg({
              ok: false,
              text: `${isAuto ? "Đã tự động chụp lại" : "Đã chụp lại"} đọc được ${res.plateDisplay}, nhưng biển này vẫn KHÔNG CÓ trong bãi — vui lòng chọn xe đang đỗ bên dưới hoặc nhập biển số thủ công.`,
            });
          }
        } else {
          setPlateInput(res.plateDisplay);
          setRecaptureMsg({
            ok: true,
            text: `Chụp lại đọc được biển số: ${res.plateDisplay} (${Math.round((res.confidence || 0) * 100)}%). Bấm Xác nhận để ${targetIsPending ? "mở cổng" : "lưu"}.`,
          });
        }
      } else {
        setRecaptureMsg({
          ok: false,
          text: `${isAuto ? "Đã tự động chụp lại" : "Đã chụp lại"} ảnh mới nhưng AI vẫn chưa đọc rõ biển số — vui lòng xem ảnh và ${targetDir === "out" ? "chọn xe trong bãi hoặc nhập thủ công" : "nhập thủ công"}.`,
        });
      }
    } catch (err: any) {
      if (isCancelled?.()) return;
      setRecaptureMsg({
        ok: false,
        text: err.message || "Lỗi khi gửi lệnh chụp lại tới Edge Server — vui lòng chọn xe hoặc nhập biển số thủ công.",
      });
    } finally {
      if (!isCancelled?.()) {
        setIsRecapturing(false);
      }
    }
  };

  // Tự động chụp lại khi xuất hiện sự kiện xe ra có biển số không nằm trong bãi đỗ
  useEffect(() => {
    if (!event || !isPendingManual || !isNotInLot) return;
    if (autoRecapturedIdsRef.current.has(event.id)) return;
    autoRecapturedIdsRef.current.add(event.id);

    let cancelled = false;
    runRecapture(event.id, "out", isPendingManual, true, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [event?.id, isPendingManual, isNotInLot]);

  if (!event) return null;

  const timeStr = event.serverTs?.toDate
    ? event.serverTs.toDate().toLocaleTimeString("vi-VN")
    : "Vừa xong";

  const filteredActiveSessions = activeSessions
    .filter((s) => {
      if (!sessionSearch) return true;
      const q = normalizePlate(sessionSearch);
      const plate = normalizePlate(s.plate);
      return plate.includes(q);
    })
    .sort((a, b) => Number(Boolean(b.exitRequested)) - Number(Boolean(a.exitRequested)));

  const normalizedInput = normalizePlate(plateInput);
  const matchedByInput =
    dir === "out" && normalizedInput
      ? activeSessions.find((s) => normalizePlate(s.plate) === normalizedInput)
      : undefined;

  const handleRecapture = () => {
    runRecapture(event.id, dir, isPendingManual, false);
  };

  const handleSelectSession = (s: Session) => {
    setSelectedSessionId(s.id);
    setPlateInput(s.plateDisplay || s.plate || "");
    setActionError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!plateInput.trim() && !selectedSessionId) {
      const msg =
        dir === "out"
          ? "Vui lòng chọn xe từ danh sách trong bãi hoặc nhập biển số."
          : "Vui lòng nhập biển số xe.";
      setActionError(msg);
      onError(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const effectiveSessionId =
        dir === "out" ? selectedSessionId || matchedByInput?.id || undefined : undefined;
      const res = await adminApi.correctPlate(event.id, plateInput.trim(), {
        sessionId: effectiveSessionId,
        imageUrl: previewImageUrl || undefined,
        cropImageUrl: previewCropUrl || undefined,
        openGate: isPendingManual,
      });

      if (dir === "out") {
        const feeText =
          typeof res.fee === "number"
            ? ` • Phí: ${res.fee.toLocaleString("vi-VN")}đ`
            : "";
        onSuccess(
          `Đã xác nhận xe ra ${res.plateDisplay || plateInput.trim()}${feeText}` +
            (res.gateOpened ? " — Đã gửi lệnh MỞ Barie Cổng RA!" : "")
        );
      } else {
        onSuccess(
          `Đã xác nhận xe vào ${res.plateDisplay || plateInput.trim()}` +
            (res.assignedSlotId ? ` (Ô ${res.assignedSlotId})` : "") +
            (res.gateOpened ? " — Đã gửi lệnh MỞ Barie Cổng VÀO!" : "")
        );
      }
      onClose();
    } catch (err: any) {
      const msg = err.message || "Lỗi khi xác nhận biển số xe.";
      setActionError(msg);
      onError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    setActionError(null);
    setIsDismissing(true);
    try {
      await adminApi.dismissGateEvent(event.id);
      onSuccess(
        isNotInLot
          ? "Đã bỏ qua sự kiện xe ra (Barie giữ đóng)."
          : "Đã bỏ qua sự kiện chưa rõ biển số (Barie giữ đóng)."
      );
      onClose();
    } catch (err: any) {
      const msg = err.message || "Lỗi khi bỏ qua sự kiện.";
      setActionError(msg);
      onError(msg);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isNotInLot
              ? "bg-rose-50 border-rose-200"
              : isPendingManual
              ? "bg-amber-50 border-amber-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl ${
                isNotInLot
                  ? "bg-rose-600 text-white"
                  : isPendingManual
                  ? "bg-amber-500 text-white"
                  : "bg-slate-800 text-white"
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-800">
                  {isPendingManual
                    ? dir === "in"
                      ? "Xe Đang Chờ Tại Cổng VÀO — Không Quét Được Biển Số"
                      : isNotInLot
                      ? "Xe Đang Chờ Tại Cổng RA — Biển Số Không Có Trong Bãi"
                      : "Xe Đang Chờ Tại Cổng RA — Không Quét Được Biển Số"
                    : "Đính Chính Biển Số Xe"}
                </h3>
                {pendingCount > 1 && (
                  <span className="text-[11px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full">
                    {pendingCount} chờ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center space-x-2">
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    dir === "in" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {dir === "in" ? "Cổng VÀO (IN)" : "Cổng RA (OUT)"}
                </span>
                <span>Lúc {timeStr}</span>
                <span className="font-mono text-slate-400">#{event.id.slice(-8)}</span>
              </p>
            </div>
          </div>

          {!isPendingManual && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {isNotInLot && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Biển số quét được{" "}
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200">
                    {event.plateDisplay || event.plateNormalized || event.plateRaw || "(trống)"}
                  </span>{" "}
                  không khớp với xe nào đang đỗ trong bãi.
                </p>
                <p className="text-rose-700 mt-1">
                  Hệ thống tự động chụp lại ảnh từ camera — nếu vẫn chưa khớp, vui lòng chọn đúng xe trong danh sách bên dưới hoặc nhập biển thủ công để đóng phiên &amp; mở Cổng RA.
                </p>
              </div>
            </div>
          )}

          {/* Khu vực ảnh chụp + Nút Chụp Lại */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-slate-500" />
                <span>Ảnh Camera Cổng</span>
              </span>
              <button
                type="button"
                disabled={isRecapturing}
                onClick={handleRecapture}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecapturing ? "animate-spin" : ""}`} />
                <span>{isRecapturing ? "Đang chụp lại..." : "Chụp lại & Quét lại OCR"}</span>
              </button>
            </div>

            {isRecapturing && (
              <div className="p-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2 border bg-blue-50 text-blue-800 border-blue-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span>Đang tự động chụp lại &amp; quét OCR từ Camera IP...</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="sm:col-span-2 bg-slate-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center border border-slate-300">
                {previewImageUrl ? (
                  <img
                    src={previewImageUrl}
                    alt="Ảnh xe tại cổng"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400 px-3 text-center">
                    Chưa có ảnh chụp (bấm "Chụp lại & Quét lại OCR" để lấy ảnh mới từ Camera IP)
                  </span>
                )}
              </div>

              <div className="bg-slate-900 rounded-lg overflow-hidden aspect-video sm:aspect-square flex flex-col items-center justify-center border border-slate-300 p-1">
                {previewCropUrl ? (
                  <img
                    src={previewCropUrl}
                    alt="Crop biển số"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 text-center px-2">
                    Chưa cắt được vùng biển số
                  </span>
                )}
              </div>
            </div>

            {recaptureMsg && (
              <div
                className={`p-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2 border ${
                  recaptureMsg.ok
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{recaptureMsg.text}</span>
              </div>
            )}
          </div>

          {/* CỔNG RA: Danh sách xe đang đỗ trong bãi để chọn */}
          {dir === "out" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Car className="w-4 h-4 text-blue-600" />
                  <span>Chọn Xe Đang Trong Bãi ({activeSessions.length} xe)</span>
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Lọc biển số..."
                    className="pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                  />
                </div>
              </div>

              {filteredActiveSessions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                  {activeSessions.length === 0
                    ? "Hiện không có xe nào đang ở trạng thái Đang đỗ (active) trong bãi."
                    : "Không tìm thấy biển số khớp bộ lọc."}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {filteredActiveSessions.map((s) => {
                    const isSelected = selectedSessionId === s.id;
                    const entryTimeStr = s.entryTime?.toDate
                      ? s.entryTime.toDate().toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-";

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSession(s)}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                          isSelected
                            ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500/30"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {s.entryImageUrl ? (
                            <img
                              src={s.entryImageUrl}
                              alt={s.plate}
                              className="w-12 h-9 object-cover rounded border border-slate-200 bg-slate-900"
                            />
                          ) : (
                            <div className="w-12 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                              <Car className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-mono font-bold text-sm text-slate-900">
                                {s.plateDisplay || s.plate}
                              </p>
                              {s.exitRequested && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Đã yêu cầu ra
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Vào lúc <span className="font-mono font-semibold">{entryTimeStr}</span>
                              {(s.actualSlotId || s.assignedSlotId) && (
                                <>
                                  {" "}• Ô{" "}
                                  <span className="font-bold text-emerald-700">
                                    {s.actualSlotId || s.assignedSlotId}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                            isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isSelected ? "Đã chọn" : "Chọn"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Ô nhập / hiển thị biển số xác nhận */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {dir === "out"
                ? "Biển Số Xe Ra Đã Chọn (Hoặc Nhập Thủ Công)"
                : "Nhập Biển Số Xe Vào (VD: 18Y-444.44 hoặc 30A12345)"}
            </label>
            <input
              type="text"
              autoFocus={dir === "in" || isNotInLot}
              required={!selectedSessionId}
              value={plateInput}
              onChange={(e) => {
                setPlateInput(e.target.value.toUpperCase());
                if (selectedSessionId) setSelectedSessionId("");
                if (actionError) setActionError(null);
              }}
              placeholder="VD: 18Y-444.44"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {dir === "out" && normalizedInput && (
              matchedByInput ? (
                <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                  ✓ Khớp xe đang đỗ trong bãi
                  {matchedByInput.actualSlotId || matchedByInput.assignedSlotId
                    ? ` (Ô ${matchedByInput.actualSlotId || matchedByInput.assignedSlotId})`
                    : ""}
                  {matchedByInput.exitRequested ? " • Đã gửi yêu cầu ra" : ""}
                </p>
              ) : (
                <p className="mt-1.5 text-xs font-semibold text-amber-700">
                  ⚠ Biển số nhập vào chưa khớp xe nào đang đỗ — hãy kiểm tra lại hoặc chọn từ danh sách xe đang trong bãi ở trên.
                </p>
              )
            )}
          </div>

          {actionError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            {isPendingManual ? (
              <button
                type="button"
                disabled={isDismissing || isSubmitting}
                onClick={handleDismiss}
                className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition disabled:opacity-50"
              >
                {isDismissing ? "Đang bỏ qua..." : "Bỏ qua (Không mở cổng)"}
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Đóng
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isDismissing || (!plateInput.trim() && !selectedSessionId)}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow transition flex items-center space-x-2 disabled:opacity-50 ${
                dir === "out" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              <DoorOpen className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? "Đang xử lý..."
                  : isPendingManual
                  ? dir === "out"
                    ? "Xác nhận Xe Ra, Tính Phí & Mở Cổng RA"
                    : "Xác nhận Biển & Mở Cổng VÀO"
                  : "Xác nhận & Cập nhật"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
