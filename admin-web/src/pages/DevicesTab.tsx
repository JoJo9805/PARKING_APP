import React, { useState } from "react";
import { Device, DeviceCommand, Lot } from "../types";
import { Cpu, DoorOpen, Radio, RefreshCw, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { ConfirmModal } from "../components/CommonModals";
import { adminApi } from "../api/adminApi";

interface Props {
  lot: Lot | null;
  devices: Device[];
  commands: DeviceCommand[];
  isLoading: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function DevicesTab({ lot, devices, commands, isLoading, onSuccess, onError }: Props) {
  const [confirmDirection, setConfirmDirection] = useState<"in" | "out" | null>(null);
  const [isSending, setIsSending] = useState(false);

  const deviceId = lot?.deviceId || "ESP32_PARKING_01";
  const isGateOnline = lot?.deviceOnline ?? true;
  const isCamOnline = lot?.camOnline ?? true;

  const handleOpenBarrier = async () => {
    if (!confirmDirection) return;

    setIsSending(true);
    try {
      const res = await adminApi.openGate(deviceId, confirmDirection);
      onSuccess(
        `Đã tạo lệnh mở barie ${confirmDirection.toUpperCase()} thành công (Mã lệnh: #${res.commandId.slice(-6)}). Edge Server đang nhận lệnh...`
      );
      setConfirmDirection(null);
    } catch (err: any) {
      onError(err.message || "Lỗi khi gửi lệnh mở barie.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Khối Điều Khiển Barie Khẩn Cấp */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
              <DoorOpen className="w-5 h-5 text-emerald-600" />
              <span>Điều Khiển Barie Khẩn Cấp (deviceCommands)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Phát lệnh mở barie cưỡng bức thông qua Firestore ➔ Edge Server ➔ Mạch ESP32
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
            <span>Thiết bị đích:</span>
            <span className="font-bold text-emerald-700">{deviceId}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => setConfirmDirection("in")}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-md shadow-emerald-600/20 transition active:scale-[0.98]"
          >
            <DoorOpen className="w-5 h-5" />
            <span>Mở Barie Cổng VÀO</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmDirection("out")}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-md shadow-blue-600/20 transition active:scale-[0.98]"
          >
            <DoorOpen className="w-5 h-5" />
            <span>Mở Barie Cổng RA</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>
            Lưu ý an toàn: Lệnh mở barie có hiệu lực 60 giây (TTL). ESP32 sẽ tự động đóng barie sau khi xe vượt qua cảm biến cổng an toàn.
          </span>
        </div>
      </div>

      {/* Trạng Thái Thiết Bị */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">NodeMCU ESP32 Chính</h4>
                <p className="text-xs text-slate-500 font-mono">{deviceId}</p>
              </div>
            </div>
            <span
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isGateOnline ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}
            >
              {isGateOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isGateOnline ? "Online" : "Offline"}</span>
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Nhiệm vụ:</span>
              <span className="font-medium">Quản lý Servo cổng, 4 cảm biến ô đỗ, LCD & OLED</span>
            </div>
            <div className="flex justify-between">
              <span>Giao thức:</span>
              <span className="font-mono text-slate-700">MQTT over Mosquitto (:1883)</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">AI-Thinker ESP32-CAM</h4>
                <p className="text-xs text-slate-500 font-mono">ESP32_CAM_01</p>
              </div>
            </div>
            <span
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isCamOnline ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}
            >
              {isCamOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isCamOnline ? "Online" : "Offline"}</span>
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Nhiệm vụ:</span>
              <span className="font-medium">Chụp biển số xe SVGA khi có xe chạm cổng</span>
            </div>
            <div className="flex justify-between">
              <span>Giao thức:</span>
              <span className="font-mono text-slate-700">HTTP POST multipart/form-data (:8000)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nhật ký lệnh điều khiển gần đây */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-base">Lệnh Điều Khiển Gần Đây (deviceCommands)</h4>
            <p className="text-xs text-slate-500 mt-0.5">Theo dõi thời gian thực vòng đời lệnh gửi xuống trạm bãi đỗ</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">{commands.length} lệnh</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Mã Lệnh</th>
                <th className="py-3 px-4">Thiết Bị</th>
                <th className="py-3 px-4">Thao Tác</th>
                <th className="py-3 px-4">Hướng</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4">Thời Gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {commands.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Chưa có lệnh điều khiển nào được phát đi.
                  </td>
                </tr>
              ) : (
                commands.map((cmd) => {
                  const status = cmd.status || "pending";
                  const timeStr = cmd.createdAt?.toDate
                    ? cmd.createdAt.toDate().toLocaleTimeString("vi-VN")
                    : "-";

                  return (
                    <tr key={cmd.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {cmd.id.slice(0, 10)}...
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{cmd.deviceId}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{cmd.action}</td>
                      <td className="py-3 px-4 uppercase font-semibold">
                        {cmd.payload?.direction || "in"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            status === "sent"
                              ? "bg-emerald-100 text-emerald-800"
                              : status === "failed"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800 animate-pulse"
                          }`}
                        >
                          {status === "pending" && <RefreshCw className="w-3 h-3 animate-spin" />}
                          <span>{status === "sent" ? "Đã gửi tới phần cứng" : status === "failed" ? "Thất bại (TTL)" : "Đang chờ Edge"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{timeStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal xác nhận mở cổng */}
      <ConfirmModal
        isOpen={!!confirmDirection}
        title="Xác nhận mở Barie khẩn cấp?"
        message={`Bạn có chắc chắn muốn gửi lệnh mở Barie CỔNG ${confirmDirection?.toUpperCase()} tới thiết bị ${deviceId}? Thanh chắn sẽ được nâng lên lập tức.`}
        confirmText="Mở Barie Ngay"
        cancelText="Đóng"
        isLoading={isSending}
        onConfirm={handleOpenBarrier}
        onClose={() => setConfirmDirection(null)}
      />
    </div>
  );
}

