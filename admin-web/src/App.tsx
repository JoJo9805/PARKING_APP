import { useState } from 'react';
import {
  LayoutDashboard,
  Camera,
  Car,
  CalendarCheck,
  Settings,
  Users,
  Cpu,
  BarChart3,
  DoorOpen,
} from 'lucide-react';

type Tab =
  | 'realtime'
  | 'gate-events'
  | 'sessions'
  | 'reservations'
  | 'pricing'
  | 'users'
  | 'devices'
  | 'analytics';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('realtime');
  const [barrierStatus, setBarrierStatus] = useState<string>('Đang đóng');
  const [actionMessage, setActionMessage] = useState<string>('');

  // Sơ đồ 4 slot mẫu của Live Lot
  const [slots] = useState([
    { id: 'A1', zone: 'A', status: 'occupied', plate: '51A-123.45', since: '14:20' },
    { id: 'A2', zone: 'A', status: 'available', plate: '', since: '' },
    { id: 'B1', zone: 'B', status: 'reserved', plate: '29C1-999.88', since: '15:10' },
    { id: 'B2', zone: 'B', status: 'available', plate: '', since: '' },
  ]);

  // Danh sách sự kiện cổng
  const [gateEvents, setGateEvents] = useState([
    { id: 'EVT-001', direction: 'in', plateRaw: '51A12345', plateDisplay: '51A-123.45', time: '14:20:15', slot: 'A1', decision: 'accepted', confidence: 0.98 },
    { id: 'EVT-002', direction: 'in', plateRaw: '29C199988', plateDisplay: '29C1-999.88', time: '14:35:10', slot: 'B1', decision: 'accepted', confidence: 0.95 },
    { id: 'EVT-003', direction: 'in', plateRaw: '43A99999', plateDisplay: '43A-999.99', time: '15:02:40', slot: '-', decision: 'denied', confidence: 0.72 },
  ]);

  // Giá bãi
  const [pricing, setPricing] = useState({
    pricePerBlock: 5000,
    blockMinutes: 30,
    graceMinutes: 0,
    depositAmount: 5000,
    freeCancelMinutes: 2,
    holdDurationMinutes: 15,
  });

  const handleOpenGate = (direction: 'in' | 'out') => {
    setBarrierStatus(`Đang mở barie ${direction.toUpperCase()}...`);
    setActionMessage(`Đã gửi lệnh mở barie ${direction.toUpperCase()} tới thiết bị ESP32.`);
    setTimeout(() => {
      setBarrierStatus('Đã mở - Tự động đóng sau 7s');
      setTimeout(() => setBarrierStatus('Đang đóng'), 7000);
    }, 1000);
  };

  const handleCorrectPlate = (eventId: string) => {
    const newPlate = prompt('Nhập biển số chính xác (ví dụ: 51A-123.45):');
    if (!newPlate) return;
    setGateEvents(prev =>
      prev.map(evt => (evt.id === eventId ? { ...evt, plateDisplay: newPlate, decision: 'accepted' } : evt))
    );
    setActionMessage(`Đã đính chính biển số cho sự kiện ${eventId} thành ${newPlate}`);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">IoT Parking</h1>
              <p className="text-xs text-slate-400">Admin Dashboard v1.1</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {[
            { id: 'realtime', label: '1. Giám sát Realtime', icon: LayoutDashboard },
            { id: 'gate-events', label: '2. Sự kiện & OCR', icon: Camera },
            { id: 'sessions', label: '3. Quản lý Phiên đỗ', icon: Car },
            { id: 'reservations', label: '4. Đặt chỗ & Cọc', icon: CalendarCheck },
            { id: 'pricing', label: '5. Cấu hình Bãi & Giá', icon: Settings },
            { id: 'users', label: '6. Người dùng & Ví', icon: Users },
            { id: 'devices', label: '7. Điều khiển Thiết bị', icon: Cpu },
            { id: 'analytics', label: '8. Báo cáo Thống kê', icon: BarChart3 },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  active ? 'bg-emerald-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
          <p>Trạm Live: <span className="text-emerald-400 font-semibold">lot_live_01</span></p>
          <p className="mt-1">Trạng thái: <span className="text-emerald-400">● Hoạt động</span></p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {activeTab === 'realtime' && 'Phân hệ 1: Giám sát Trực quan Thời Gian Thực'}
              {activeTab === 'gate-events' && 'Phân hệ 2: Sự kiện Cổng & Đối soát Biển Số OCR'}
              {activeTab === 'sessions' && 'Phân hệ 3: Quản lý Phiên đỗ Xe'}
              {activeTab === 'reservations' && 'Phân hệ 4: Quản lý Đặt chỗ & Đối trừ Cọc'}
              {activeTab === 'pricing' && 'Phân hệ 5: Cấu hình Bãi đỗ & Bảng giá Block'}
              {activeTab === 'users' && 'Phân hệ 6: Quản lý Người dùng & Điều chỉnh Ví'}
              {activeTab === 'devices' && 'Phân hệ 7: Điều khiển & Giám sát Thiết bị IoT'}
              {activeTab === 'analytics' && 'Phân hệ 8: Báo cáo Thống kê Doanh thu & OCR'}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 font-medium">
              Barie: {barrierStatus}
            </span>
            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
              AD
            </div>
          </div>
        </header>

        {actionMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-8 py-2 text-emerald-800 text-sm flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage('')} className="font-bold ml-4">✕</button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'realtime' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-4 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Tổng số ô đỗ</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">4</p>
                  <p className="text-xs text-slate-400 mt-1">Khu A (2) + Khu B (2)</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Chỗ còn trống</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">2</p>
                  <p className="text-xs text-emerald-600 mt-1">Sẵn sàng nhận xe</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Xe đang đỗ</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">1</p>
                  <p className="text-xs text-blue-500 mt-1">Ô A1 (51A-123.45)</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Đang giữ chỗ</p>
                  <p className="text-3xl font-bold text-amber-500 mt-2">1</p>
                  <p className="text-xs text-amber-600 mt-1">Ô B1 (Cọc 5.000đ)</p>
                </div>
              </div>

              {/* Sơ đồ 4 slot Live */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Mặt Bằng 4 Slot Bãi Live (ESP32)</h3>
                    <p className="text-sm text-slate-500">Cập nhật realtime từ cảm biến tiệm cận & sự kiện cổng</p>
                  </div>
                  <div className="flex space-x-3 text-xs">
                    <span className="flex items-center"><span className="w-3 h-3 bg-emerald-500 rounded mr-1.5"></span> Trống (Available)</span>
                    <span className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded mr-1.5"></span> Đang đỗ (Occupied)</span>
                    <span className="flex items-center"><span className="w-3 h-3 bg-amber-500 rounded mr-1.5"></span> Giữ chỗ (Reserved)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto py-4">
                  {slots.map(s => (
                    <div
                      key={s.id}
                      className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center transition shadow-sm ${
                        s.status === 'available'
                          ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800'
                          : s.status === 'occupied'
                          ? 'border-blue-400 bg-blue-50 text-blue-900'
                          : 'border-amber-400 bg-amber-50 text-amber-900'
                      }`}
                    >
                      <span className="text-3xl font-black">{s.id}</span>
                      <span className="text-xs uppercase tracking-wider font-semibold mt-1">Khu {s.zone}</span>
                      <div className="mt-4 text-center">
                        {s.status === 'available' ? (
                          <span className="inline-block bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-medium">TRỐNG</span>
                        ) : s.status === 'occupied' ? (
                          <div>
                            <span className="inline-block bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">ĐANG ĐỖ</span>
                            <p className="font-bold text-sm mt-2">{s.plate}</p>
                            <p className="text-xs text-slate-500">Từ {s.since}</p>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-block bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-medium">ĐÃ GIỮ CHỖ</span>
                            <p className="font-bold text-sm mt-2">{s.plate}</p>
                            <p className="text-xs text-slate-500">Từ {s.since}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gate-events' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">Nhật Ký Sự Kiện Cổng (gateEvents)</h3>
                  <p className="text-sm text-slate-500">Đối soát ảnh camera và kết quả nhận diện biển số OCR</p>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Mã Sự Kiện</th>
                    <th className="py-3 px-4">Hướng</th>
                    <th className="py-3 px-4">Biển Số Nhận Diện</th>
                    <th className="py-3 px-4">Độ Tin Cậy</th>
                    <th className="py-3 px-4">Ô Gán</th>
                    <th className="py-3 px-4">Quyết Định</th>
                    <th className="py-3 px-4">Thời Gian</th>
                    <th className="py-3 px-4">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gateEvents.map(evt => (
                    <tr key={evt.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{evt.id}</td>
                      <td className="py-3 px-4 uppercase font-semibold text-xs">
                        <span className={`px-2 py-0.5 rounded ${evt.direction === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {evt.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{evt.plateDisplay}</td>
                      <td className="py-3 px-4 text-slate-600">{(evt.confidence * 100).toFixed(0)}%</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{evt.slot}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${evt.decision === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {evt.decision === 'accepted' ? 'Hợp lệ' : 'Từ chối'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{evt.time}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleCorrectPlate(evt.id)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded transition"
                        >
                          Sửa biển số
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 text-lg mb-2">Điều Khiển Cổng Khẩn Cấp (deviceCommands)</h3>
                <p className="text-sm text-slate-500 mb-6">Mở barie khẩn cấp trong trường hợp kẹt xe hoặc sự cố nhận diện</p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleOpenGate('in')}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-lg font-bold shadow transition"
                  >
                    <DoorOpen className="w-5 h-5" />
                    <span>Mở Barie Cổng VÀO</span>
                  </button>
                  <button
                    onClick={() => handleOpenGate('out')}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-bold shadow transition"
                  >
                    <DoorOpen className="w-5 h-5" />
                    <span>Mở Barie Cổng RA</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {[
                  { name: 'ESP32 Main Gate Controller', id: 'ESP32_STATION_01', status: 'Online', ip: '192.168.1.101' },
                  { name: 'ESP32-CAM (Cổng Vào)', id: 'CAM_IN_01', status: 'Online', ip: '192.168.1.102' },
                  { name: 'Edge AI Server (YOLO/OCR)', id: 'EDGE_SERVER_01', status: 'Online', ip: '192.168.1.200' },
                ].map(d => (
                  <div key={d.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{d.name}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">● {d.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">ID: {d.id}</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">IP: {d.ip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-xl">
              <h3 className="font-bold text-slate-800 text-lg mb-4">Cấu Hình Bảng Giá Bãi Xe (Chuẩn v1.1)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Giá mỗi block (VNĐ)</label>
                  <input
                    type="number"
                    value={pricing.pricePerBlock}
                    onChange={e => setPricing({ ...pricing, pricePerBlock: Number(e.target.value) })}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Thời gian 1 block (Phút)</label>
                  <input
                    type="number"
                    value={pricing.blockMinutes}
                    onChange={e => setPricing({ ...pricing, blockMinutes: Number(e.target.value) })}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Thời gian miễn phí graceMinutes (Phút)</label>
                  <input
                    type="number"
                    value={pricing.graceMinutes}
                    onChange={e => setPricing({ ...pricing, graceMinutes: Number(e.target.value) })}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Tiền cọc đặt chỗ mặc định (VNĐ)</label>
                  <input
                    type="number"
                    value={pricing.depositAmount}
                    onChange={e => setPricing({ ...pricing, depositAmount: Number(e.target.value) })}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
                <button
                  onClick={() => setActionMessage('Đã cập nhật bảng giá bãi đỗ xe thành công.')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg transition"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg mb-4">Danh Sách Phiên Đỗ (sessions)</h3>
              <p className="text-sm text-slate-500 mb-4">Các phiên đỗ đang hoạt động hoặc đã hoàn tất</p>
              <div className="divide-y divide-slate-100">
                <div className="py-4 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-base">51A-123.45</span>
                    <span className="ml-3 text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-semibold">Đang đỗ (Ô A1)</span>
                    <p className="text-xs text-slate-500 mt-1">Giờ vào: 14:20:15 (Đã đỗ: 45 phút) | Cọc đã đối trừ: 5.000đ</p>
                  </div>
                  <button
                    onClick={() => setActionMessage('Đã đóng phiên đỗ thủ công qua adminCloseSession')}
                    className="text-xs bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    Đóng Phiên Thủ Công
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reservations' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg mb-4">Danh Sách Đặt Chỗ & Đối Trừ Cọc (reservations)</h3>
              <p className="text-sm text-slate-500 mb-4">Quản lý và hoàn cọc cho khách hàng</p>
              <div className="divide-y divide-slate-100">
                <div className="py-4 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-base">29C1-999.88</span>
                    <span className="ml-3 text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold">Đang giữ chỗ (Ô B1)</span>
                    <p className="text-xs text-slate-500 mt-1">Thời gian hết hạn: còn 8 phút | Tiền cọc: 5.000đ (held)</p>
                  </div>
                  <button
                    onClick={() => setActionMessage('Đã thực hiện hoàn cọc thủ công cho khách qua adminRefundDeposit')}
                    className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    Hoàn Cọc Thủ Công
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg mb-4">Tra Cứu Người Dùng & Điều Chỉnh Số Dư Ví</h3>
              <div className="flex space-x-3 mb-6">
                <input
                  type="text"
                  placeholder="Nhập email hoặc UID người dùng..."
                  className="flex-1 border border-slate-300 rounded-lg p-2.5 text-sm"
                />
                <button className="bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
                  Tìm kiếm
                </button>
              </div>
              <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">Nguyễn Văn A (demo.user@iotparking.vn)</p>
                  <p className="text-sm text-slate-600 mt-1">Số dư ví hiện tại: <span className="font-bold text-emerald-600">85.000đ</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Xe đã đăng ký: 51A-123.45 (Mặc định)</p>
                </div>
                <button
                  onClick={() => {
                    const amount = prompt('Nhập số tiền điều chỉnh (VD: 50000 hoặc -20000):');
                    if (amount) setActionMessage(`Đã điều chỉnh ví người dùng: ${amount}đ qua adminAdjustBalance`);
                  }}
                  className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
                >
                  Điều Chỉnh Số Dư
                </button>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Doanh thu ngày hôm nay</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">485.000đ</p>
                  <p className="text-xs text-slate-400 mt-1">Phí đỗ xe + Cọc thu</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Tổng lượt xe vào/ra</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">42 lượt</p>
                  <p className="text-xs text-emerald-600 mt-1">Tỷ lệ lấp đầy: 82%</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Tỷ lệ nhận diện OCR thành công</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">97.6%</p>
                  <p className="text-xs text-blue-500 mt-1">YOLOv8 + EasyOCR Edge</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

