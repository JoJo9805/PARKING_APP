import React, { useMemo } from "react";
import { GateEvent, Reservation, Session, Transaction } from "../types";
import { BarChart3, Camera, CheckCircle2, TrendingUp, Wallet, XCircle } from "lucide-react";

interface Props {
  transactions: Transaction[];
  reservations: Reservation[];
  events: GateEvent[];
  sessions: Session[];
  isLoading: boolean;
}

export function AnalyticsTab({ transactions, reservations, events, sessions, isLoading }: Props) {
  // 1. Doanh thu phí đỗ
  const parkingFeeTotal = useMemo(() => {
    return transactions
      .filter((t) => t.type === "parking_fee")
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  }, [transactions]);

  // 2. Tiền cọc quá hạn bị tịch thu
  const forfeitedDepositTotal = useMemo(() => {
    return reservations
      .filter((r) => r.depositStatus === "forfeited")
      .reduce((sum, r) => sum + (r.depositAmount || 5000), 0);
  }, [reservations]);

  // 3. Tiền hoàn cọc dư
  const excessRefundTotal = useMemo(() => {
    return transactions
      .filter((t) => t.type === "deposit_excess_refund")
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  }, [transactions]);

  // 4. Tổng doanh thu thuần
  const netRevenue = parkingFeeTotal + forfeitedDepositTotal;

  // 5. Thống kê OCR
  const ocrStats = useMemo(() => {
    if (events.length === 0) {
      return { total: 0, acceptedRate: 100, avgLatency: 55 };
    }
    const acceptedCount = events.filter((e) => e.decision === "accepted").length;
    const rate = (acceptedCount / events.length) * 100;

    const latencies = events.filter((e) => e.latencyMs && e.latencyMs > 0).map((e) => e.latencyMs!);
    const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 50;

    return {
      total: events.length,
      acceptedRate: Math.round(rate),
      avgLatency: Math.round(avg),
    };
  }, [events]);

  // 6. Nhóm doanh thu 7 ngày gần nhất
  const dailyData = useMemo(() => {
    const days: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      days[key] = 0;
    }

    transactions
      .filter((t) => t.type === "parking_fee")
      .forEach((t) => {
        const ms = t.createdAt?.toMillis ? t.createdAt.toMillis() : t.createdAt || 0;
        if (!ms) return;
        const d = new Date(ms);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        if (days[key] !== undefined) {
          days[key] += Math.abs(t.amount || 0);
        }
      });

    return Object.entries(days).map(([label, amount]) => ({ label, amount }));
  }, [transactions]);

  const maxDaily = Math.max(...dailyData.map((d) => d.amount), 50000);

  return (
    <div className="space-y-6">
      {/* 4 Card Chỉ Số Tài Chính & Kỹ Thuật */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng Doanh Thu Thuần</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{netRevenue.toLocaleString("vi-VN")}đ</p>
          <p className="text-xs text-slate-400 mt-1">Phí đỗ + Cọc tịch thu quá hạn</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Phí Đỗ Xe Thu Về</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-3xl font-black text-blue-600 mt-2">{parkingFeeTotal.toLocaleString("vi-VN")}đ</p>
          <p className="text-xs text-slate-400 mt-1">Tính theo block 30 phút</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Cọc Quá Hạn Tịch Thu</span>
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-purple-600 mt-2">{forfeitedDepositTotal.toLocaleString("vi-VN")}đ</p>
          <p className="text-xs text-slate-400 mt-1">
            {reservations.filter((r) => r.depositStatus === "forfeited").length} lượt quá hạn 15p
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Độ Tin Cậy AI OCR</span>
            <Camera className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-3xl font-black text-emerald-600">{ocrStats.acceptedRate}%</span>
            <span className="text-xs font-mono text-slate-500">~{ocrStats.avgLatency}ms/ảnh</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{ocrStats.total} lượt nhận diện biển số</p>
        </div>
      </div>

      {/* Biểu Đồ Doanh Thu 7 Ngày Gần Nhất */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="pb-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Biểu Đồ Doanh Thu 7 Ngày Gần Nhất</h3>
              <p className="text-xs text-slate-500 mt-0.5">Thống kê doanh thu theo từng ngày từ hệ thống giao dịch</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
              Tự động tổng hợp
            </span>
          </div>

          <div className="mt-8 flex items-end justify-between space-x-3 h-56 pt-8 pb-2 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
            {dailyData.map((d, idx) => {
              const heightPct = Math.max(10, Math.round((d.amount / maxDaily) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <span className="text-[10px] font-mono font-bold text-slate-600 mb-2 opacity-0 group-hover:opacity-100 transition">
                    {d.amount > 0 ? `${(d.amount / 1000).toFixed(0)}k` : "0"}
                  </span>
                  <div className="w-full max-w-[40px] bg-slate-200 rounded-t-lg overflow-hidden flex items-end h-full">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t-lg transition-all duration-500 shadow-sm"
                    ></div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 mt-2">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tổng Quan Hoàn Cọc Dư & Chỉ Số Vận Hành */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base pb-4 border-b border-slate-100">
              Chỉ Số Vận Hành Bãi Đỗ
            </h3>

            <div className="mt-5 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Tổng số lượt vào bãi</p>
                  <p className="text-lg font-black text-slate-800 mt-0.5">{sessions.length} lượt</p>
                </div>
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Cọc dư đã hoàn trả khách</p>
                  <p className="text-lg font-black text-purple-700 mt-0.5">
                    {excessRefundTotal.toLocaleString("vi-VN")}đ
                  </p>
                </div>
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Phiên đang phục vụ</p>
                  <p className="text-lg font-black text-blue-600 mt-0.5">
                    {sessions.filter((s) => s.status === "active").length} xe
                  </p>
                </div>
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-4">
            Dữ liệu được cập nhật theo thời gian thực từ Firestore.
          </p>
        </div>
      </div>
    </div>
  );
}

