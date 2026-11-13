import React, { useState } from "react";
import {
  LayoutDashboard,
  Camera,
  Car,
  CalendarCheck,
  Settings,
  Cpu,
  LogOut,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AdminGuard } from "./auth/AdminGuard";
import {
  useLot,
  useSlots,
  useGateEvents,
  useSessions,
  useReservations,
  useDevices,
  useDeviceCommands,
  useTransactions,
} from "./hooks/useParkingData";
import { RealtimeMonitorTab } from "./pages/RealtimeMonitorTab";
import { GateEventsTab } from "./pages/GateEventsTab";
import { SessionsTab } from "./pages/SessionsTab";
import { ReservationsTab } from "./pages/ReservationsTab";
import { PricingConfigTab } from "./pages/PricingConfigTab";
import { DevicesTab } from "./pages/DevicesTab";

type Tab =
  | "realtime"
  | "gate-events"
  | "sessions"
  | "reservations"
  | "pricing"
  | "devices";

function DashboardContent() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("realtime");

  // Thông báo Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showSuccess = (msg: string) => setToast({ message: msg, type: "success" });
  const showError = (msg: string) => setToast({ message: msg, type: "error" });

  // Hooks dữ liệu realtime
  const { lot, loading: loadingLot, updateConfig } = useLot("lot_live_01");
  const { slots, loading: loadingSlots } = useSlots("lot_live_01");
  const { events, loading: loadingEvents } = useGateEvents("lot_live_01", 50);
  const { sessions, loading: loadingSessions } = useSessions(50);
  const { reservations, loading: loadingReservations } = useReservations(50);
  const { devices, loading: loadingDevices } = useDevices();
  const { commands, loading: loadingCommands } = useDeviceCommands(20);
  const { transactions, loading: loadingTransactions } = useTransactions(100);

  const isGateOnline = lot?.deviceOnline ?? false;

  return (
    <div className="flex h-screen bg-slate-50 font-sans antialiased text-slate-900">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 select-none">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">IoT Parking</h1>
              <p className="text-xs text-slate-400 font-medium">Bảng Điều Khiển Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {[
            { id: "realtime", label: "1. Giám sát Realtime", icon: LayoutDashboard },
            { id: "gate-events", label: "2. Sự kiện & OCR", icon: Camera },
            { id: "sessions", label: "3. Quản lý Phiên đỗ", icon: Car },
            { id: "reservations", label: "4. Đặt chỗ & Cọc", icon: CalendarCheck },
            { id: "pricing", label: "5. Cấu hình Bãi & Giá", icon: Settings },
            { id: "devices", label: "6. Điều khiển Thiết bị", icon: Cpu },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition ${
                  active
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Trạng thái bãi live */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center justify-between mb-1">
            <span>Trạm Live:</span>
            <span className="text-emerald-400 font-mono font-bold">lot_live_01</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Thiết bị:</span>
            <span className={`flex items-center font-medium ${isGateOnline ? "text-emerald-400" : "text-rose-400"}`}>
              <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${isGateOnline ? "bg-emerald-500" : "bg-rose-500"}`}></span>
              ESP32_PARKING_01
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {activeTab === "realtime" && "Phân hệ 1: Giám Sát Trực Quan Thời Gian Thực"}
              {activeTab === "gate-events" && "Phân hệ 2: Sự Kiện Cổng & Đối Soát Biển Số OCR"}
              {activeTab === "sessions" && "Phân hệ 3: Quản Lý Phiên Đỗ Xe"}
              {activeTab === "reservations" && "Phân hệ 4: Quản Lý Đặt Chỗ & Đối Trừ Cọc"}
              {activeTab === "pricing" && "Phân hệ 5: Cấu Hình Bãi Đỗ & Bảng Giá Block"}
              {activeTab === "devices" && "Phân hệ 6: Điều Khiển & Giám Sát Thiết Bị IoT"}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            {/* Trạng thái phần cứng */}
            <div
              className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
                isGateOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {isGateOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isGateOnline ? "ESP32 Sẵn Sàng" : "ESP32 Mất Kết Nối"}</span>
            </div>

            {/* Tài khoản Admin & Đăng xuất */}
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {user?.displayName || "Admin"}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">{user?.email}</p>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Toast thông báo */}
        {toast && (
          <div
            className={`px-8 py-2.5 text-xs font-semibold flex items-center justify-between border-b transition ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center space-x-2">
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-500 hover:text-slate-800 font-bold p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 p-8 overflow-y-auto">
          {activeTab === "realtime" && (
            <RealtimeMonitorTab
              lot={lot}
              slots={slots}
              transactions={transactions}
              isLoading={loadingSlots || loadingLot}
            />
          )}

          {activeTab === "gate-events" && (
            <GateEventsTab
              events={events}
              isLoading={loadingEvents}
              onSuccess={showSuccess}
              onError={showError}
            />
          )}

          {activeTab === "sessions" && (
            <SessionsTab
              sessions={sessions}
              isLoading={loadingSessions}
              onSuccess={showSuccess}
              onError={showError}
            />
          )}

          {activeTab === "reservations" && (
            <ReservationsTab
              reservations={reservations}
              lot={lot}
              slots={slots}
              isLoading={loadingReservations}
              onSuccess={showSuccess}
              onError={showError}
            />
          )}

          {activeTab === "pricing" && (
            <PricingConfigTab
              lot={lot}
              isLoading={loadingLot}
              onUpdate={updateConfig}
              onSuccess={showSuccess}
              onError={showError}
            />
          )}

          {activeTab === "devices" && (
            <DevicesTab
              lot={lot}
              devices={devices}
              commands={commands}
              isLoading={loadingCommands}
              onSuccess={showSuccess}
              onError={showError}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdminGuard>
        <DashboardContent />
      </AdminGuard>
    </AuthProvider>
  );
}
