import React, { useEffect, useState } from "react";
import { Lot } from "../types";
import { Calculator, Check, Save, Settings } from "lucide-react";

interface Props {
  lot: Lot | null;
  isLoading: boolean;
  onUpdate: (newConfig: Partial<Lot>) => Promise<void>;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function PricingConfigTab({ lot, isLoading, onUpdate, onSuccess, onError }: Props) {
  const [pricePerBlock, setPricePerBlock] = useState(20000);
  const [blockMinutes, setBlockMinutes] = useState(60);
  const [graceMinutes, setGraceMinutes] = useState(0);
  const [depositAmount, setDepositAmount] = useState(5000);
  const [freeCancelMinutes, setFreeCancelMinutes] = useState(2);
  const [holdDurationMinutes, setHoldDurationMinutes] = useState(15);
  const [isSaving, setIsSaving] = useState(false);

  // Trạng thái cho công cụ tính nhẩm (Preview Calculator)
  const [testDuration, setTestDuration] = useState(35);
  const [testDeposit, setTestDeposit] = useState(5000);

  useEffect(() => {
    if (lot) {
      setPricePerBlock(lot.pricePerBlock ?? 20000);
      setBlockMinutes(lot.blockMinutes ?? 60);
      setGraceMinutes(lot.graceMinutes ?? 0);
      setDepositAmount(lot.depositAmount ?? 5000);
      setFreeCancelMinutes(lot.freeCancelMinutes ?? 2);
      setHoldDurationMinutes(lot.holdDurationMinutes ?? 15);
    }
  }, [lot]);

  // Tính nhẩm công thức chuẩn v1.1
  const calcPreview = () => {
    let fee = 0;
    if (graceMinutes > 0 && testDuration <= graceMinutes) {
      fee = 0;
    } else {
      const billable = Math.max(1, testDuration - graceMinutes);
      const blocks = Math.ceil(billable / blockMinutes);
      fee = blocks * pricePerBlock;
    }

    let depositRefund = 0;
    let amountCharged = 0;
    if (fee >= testDeposit) {
      amountCharged = fee - testDeposit;
      depositRefund = 0;
    } else {
      amountCharged = 0;
      depositRefund = testDeposit - fee;
    }

    return { fee, amountCharged, depositRefund };
  };

  const previewResult = calcPreview();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdate({
        pricePerBlock: Number(pricePerBlock),
        blockMinutes: Number(blockMinutes),
        graceMinutes: Number(graceMinutes),
        depositAmount: Number(depositAmount),
        freeCancelMinutes: Number(freeCancelMinutes),
        holdDurationMinutes: Number(holdDurationMinutes),
      });
      onSuccess("Đã lưu cấu hình bảng giá bãi đỗ xe thành công!");
    } catch (err: any) {
      onError(err.message || "Lỗi khi lưu cấu hình.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form Cấu Hình Bảng Giá */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="pb-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
              <Settings className="w-5 h-5 text-emerald-600" />
              <span>Cấu Hình Bãi Đỗ & Bảng Giá Block ({lot?.id || "lot_live_01"})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Các thay đổi sẽ được áp dụng ngay lập tức cho các phiên đỗ mới và lượt đặt chỗ mới
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Giá Mỗi Block (VND)
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={pricePerBlock}
                onChange={(e) => setPricePerBlock(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Mặc định: 5.000đ</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Thời Lượng 1 Block (Phút)
              </label>
              <select
                value={blockMinutes}
                onChange={(e) => setBlockMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={15}>15 phút</option>
                <option value={30}>30 phút (Chuẩn v1.1)</option>
                <option value={60}>60 phút (1 tiếng)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Chu kỳ làm tròn cước</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Thời Gian Miễn Phí (Grace Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                required
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Nếu đỗ ≤ số phút này, phí = 0đ</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Số Tiền Đặt Cọc (VND)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Thu từ ví khi người dùng giữ chỗ</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Hạn Hủy Miễn Phí (Phút)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                required
                value={freeCancelMinutes}
                onChange={(e) => setFreeCancelMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Hủy trong thời gian này được hoàn 100%</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Thời Hạn Giữ Chỗ (Phút)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                required
                value={holdDurationMinutes}
                onChange={(e) => setHoldDurationMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Quá hạn không vào sẽ bị tịch thu cọc</p>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Đang lưu..." : "Lưu Thay Đổi"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Máy Tính Nhẩm Cước Phí Trực Quan (Interactive Calculator) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2 pb-4 border-b border-slate-100">
            <Calculator className="w-5 h-5 text-blue-600" />
            <span>Mô Phỏng Tính Phí (v1.1)</span>
          </h3>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Thời gian đỗ thử nghiệm: <span className="font-bold text-emerald-700">{testDuration} phút</span>
              </label>
              <input
                type="range"
                min="1"
                max="180"
                value={testDuration}
                onChange={(e) => setTestDuration(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tiền cọc đã nộp: <span className="font-bold text-emerald-700">{testDeposit.toLocaleString("vi-VN")}đ</span>
              </label>
              <select
                value={testDeposit}
                onChange={(e) => setTestDeposit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                <option value={0}>Không đặt cọc (0đ)</option>
                <option value={5000}>Có đặt cọc (5.000đ)</option>
              </select>
            </div>

            {/* Chi tiết tính nhẩm */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Số block tính phí:</span>
                <span className="font-bold font-mono">
                  {graceMinutes > 0 && testDuration <= graceMinutes
                    ? 0
                    : Math.ceil(Math.max(1, testDuration - graceMinutes) / blockMinutes)}{" "}
                  block
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Phí đỗ gốc:</span>
                <span className="font-bold font-mono text-slate-800">{previewResult.fee.toLocaleString("vi-VN")}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Khấu trừ tiền cọc:</span>
                <span className="font-bold font-mono text-slate-500">
                  -{Math.min(previewResult.fee, testDeposit).toLocaleString("vi-VN")}đ
                </span>
              </div>
              {previewResult.depositRefund > 0 && (
                <div className="flex justify-between text-purple-700 font-bold bg-purple-50 p-1.5 rounded">
                  <span>Hoàn cọc dư vào ví:</span>
                  <span className="font-mono">+{previewResult.depositRefund.toLocaleString("vi-VN")}đ</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-emerald-700">
                <span>Thực thu qua ví:</span>
                <span className="font-mono">{previewResult.amountCharged.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-4 leading-normal">
          Công thức: $\lceil(t - grace) / block\rceil \times price$. Khi phí &lt; cọc, tự động hoàn cọc dư vào ví khách hàng.
        </p>
      </div>
    </div>
  );
}

