import React from "react";
import { Lot, Slot, Transaction } from "../types";

interface Props {
  lot: Lot | null;
  slots: Slot[];
  transactions: Transaction[];
  isLoading: boolean;
}

export function RealtimeMonitorTab({ lot, slots }: Props) {
  // Thống kê 4 ô (ưu tiên trạng thái cảm biến có vật thể -> Đang đỗ)
  const occupiedCount = slots.filter((s) => s.status === "occupied" || s.sensorOccupied).length;
  const reservedCount = slots.filter((s) => !s.sensorOccupied && s.status === "reserved").length;
  const availableCount = slots.filter((s) => !s.sensorOccupied && s.status === "available").length;

  return (
    <div className="space-y-6">
      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng Số Ô Đỗ</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-800">{slots.length || lot?.totalSlots || 4}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Bãi: {lot?.name || "Bãi Live ESP32"}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className={`text-xs font-semibold uppercase tracking-wider ${availableCount === 0 ? "text-rose-600" : "text-emerald-600"}`}>
            Chỗ Còn Trống
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-3xl font-black ${availableCount === 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {availableCount}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                availableCount === 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {availableCount === 0 ? "Đầy" : "Sẵn sàng"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Khớp cảm biến hồng ngoại & cọc</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Xe Đang Đỗ</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-blue-600">{occupiedCount}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {occupiedCount > 0 ? "Đang có xe tại bãi" : "Chưa có xe"} ({reservedCount} ô giữ chỗ)
          </p>
        </div>
      </div>

      {/* Sơ đồ 4 slot Live */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-slate-800">Mặt Bằng 4 Slot Bãi Live ({lot?.id || "lot_live_01"})</h3>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dữ liệu đồng bộ trực tiếp từ cảm biến tiệm cận ESP32 & camera nhận diện biển số
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-medium">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-emerald-500 rounded mr-1.5 shadow-sm"></span> Trống (Available)
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded mr-1.5 shadow-sm"></span> Đang đỗ (Occupied)
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-amber-500 rounded mr-1.5 shadow-sm"></span> Đã giữ chỗ (Reserved)
            </span>
          </div>
        </div>

        {/* 4 ô đỗ chia 2 khu A & B */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto py-8">
          {slots.map((s) => {
            const isOccupied = s.status === "occupied" || Boolean(s.sensorOccupied);
            const isReserved = !isOccupied && s.status === "reserved";
            const isAvailable = !isOccupied && !isReserved;

            return (
              <div
                key={s.id}
                className={`relative p-7 rounded-2xl border-2 transition-all shadow-sm flex flex-col items-center justify-center min-h-[220px] ${
                  isAvailable
                    ? "border-emerald-300 bg-emerald-50/40 text-emerald-950"
                    : isOccupied
                    ? "border-blue-300 bg-blue-50/50 text-blue-950"
                    : "border-amber-300 bg-amber-50/50 text-amber-950"
                }`}
              >

                <div className="text-center">
                  <span className="text-4xl font-black tracking-tight">{s.id}</span>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mt-1">Khu {s.zone}</p>
                </div>

                <div className="mt-5 text-center w-full">
                  {isAvailable && (
                    <span className="inline-block bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                      SẴN SÀNG ĐÓN XE
                    </span>
                  )}

                  {isOccupied && (
                    <div>
                      <span className="inline-block bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                        XE ĐANG ĐỖ
                      </span>
                      {s.plate && (
                        <p className="font-mono font-bold text-base mt-2.5 text-blue-900 bg-white/70 py-1 px-3 rounded-lg border border-blue-200">
                          {s.plate}
                        </p>
                      )}
                      {s.sessionId && (
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">Phiên: #{s.sessionId.slice(-6)}</p>
                      )}
                    </div>
                  )}

                  {isReserved && (
                    <div>
                      <span className="inline-block bg-amber-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                        ĐÃ ĐƯỢC GIỮ CHỖ
                      </span>
                      <p className="text-xs text-amber-900 font-semibold mt-2">Cọc: 5.000đ (Tối đa 15p)</p>
                      {s.reservationId && (
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">Mã cọc: #{s.reservationId.slice(-6)}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/50 w-full flex items-center justify-center text-[11px] text-slate-500">
                  <span>Cảm biến: {s.sensorOccupied ? "Có vật thể (Đang đỗ)" : "Trống"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

