# IoT Smart Parking — Android App (`android-app/`)

Ứng dụng di động dành cho người dùng cuối trong Hệ thống Bãi đỗ xe Thông minh (Smart Parking System), tuân thủ 100% đặc tả v1.1 theo `Plan_Repo2_Android_And_Cloud_Backend.md`.

---

## 1. Công nghệ sử dụng
- **Ngôn ngữ & UI:** Kotlin 2.1, Jetpack Compose, Material 3, Edge-to-Edge (`enableEdgeToEdge`).
- **Kiến trúc:** Clean Architecture + MVVM (MVI stateful UI với `StateFlow<UiState>`).
- **Dependency Injection:** Dagger Hilt 2.53 (`@HiltAndroidApp`, `@HiltViewModel`, `@HiltWorker`).
- **Bản đồ:** Google Maps Compose + Fused Location Provider Client (Haversine distance).
- **Lưu trữ & Cache:** Jetpack Preferences DataStore (Nguồn sự thật duy nhất cho cài đặt client).
- **Backend & Cloud:** Firebase Auth (Email/Password), Cloud Firestore (12 collections, whitelist rules v1.1), Cloud Functions (13 callables), Cloud Storage, Firebase Cloud Messaging (FCM Data-only).
- **Nhiệm vụ nền:** WorkManager (Expedited workers cho action trên thông báo; Periodic reconcile 15 phút).
- **Tiện ích màn hình chính:** Jetpack Glance Widget (4×2) với 3 chế độ (Rảnh, Giữ chỗ, Đang đỗ).
- **Biểu đồ thống kê:** Vico Charts (Biểu đồ cột chi tiêu 6 tháng).
- **Tải ảnh:** Coil Compose.

---

## 2. Danh sách 17 Màn hình (5 Tab chính)

1. **Splash & Onboarding:**
   - `SplashScreen`: Kiểm tra đăng nhập và điều hướng tự động.
   - `OnboardingScreen`: Giới thiệu 3 bước + xin quyền Vị trí & Thông báo runtime.
2. **Xác thực (Auth):**
   - `LoginScreen`: Đăng nhập Email/Mật khẩu.
   - `RegisterScreen`: Đăng ký tài khoản kèm thước đo độ mạnh mật khẩu.
   - `ForgotPasswordScreen`: Gửi email khôi phục mật khẩu.
3. **Tab 1: Khám phá (Explore / Map):**
   - `HomeScreen`: Bản đồ Google Maps, thanh tìm kiếm, ghim `ActiveBanner`, `OfflineBanner`, danh sách bãi trượt từ dưới lên (BottomSheet).
   - `FilterSheet`: Bộ lọc nâng cao theo giá, khoảng cách, loại xe, mái che, cổng sạc EV.
   - `LotCard`: Thẻ tóm tắt thông tin bãi đỗ xe và số chỗ trống.
4. **Chi tiết & Đặt chỗ (Lot & Reservation):**
   - `LotDetailScreen`: Thông tin bãi, ảnh chụp, bảng giá, sơ đồ 4 ô realtime, nút chỉ đường và nút đặt chỗ.
   - `SlotSelectionScreen`: Chọn ô đỗ mong muốn (A1, A2, B1, B2) hoặc chọn tự động gán.
   - `ReservationConfirmScreen`: Xác nhận đặt chỗ, chọn xe, khấu trừ cọc 5.000đ, kiểm tra số dư ví và chặn ví âm.
   - `ActiveReservationScreen`: Đếm ngược thời gian giữ chỗ 15 phút theo giờ server (`TimeOffsetProvider`), chỉ đường, gia hạn +15p, hủy cọc kèm vùng đệm dự báo mốc 2 phút.
5. **Tab 2: Hoạt động (Activity / Session):**
   - `SessionScreen`: Phiên đỗ xe hiện tại, đồng hồ giây đếm thời gian đỗ, tính phí tạm tính thời gian thực cập nhật theo phút, đối trừ cọc & hiển thị hoàn cọc dư, ảnh xe vào cổng, sơ đồ chỉ dẫn rẽ từ cổng, gia hạn thời lượng đỗ.
6. **Tab 3: Lịch sử (History):**
   - `HistoryScreen`: Danh sách các chuyến đỗ xe quá khứ, lọc theo tháng/năm và theo xe.
   - `InvoiceDetailScreen`: Chi tiết hóa đơn thanh toán mã `INV-...`, chi tiết phí gốc, trừ cọc, hoàn cọc dư, xem ảnh đối soát xe vào và xe ra.
   - `StatisticsScreen`: Thống kê chi tiêu 6 tháng gần nhất bằng biểu đồ trực quan.
7. **Tab 4: Ví nội bộ (Wallet):**
   - `WalletScreen`: Xem số dư ví, cảnh báo khi ví âm, nạp nhanh 20k–200k, lịch sử giao dịch nạp tiền/trừ cọc/hoàn cọc/thanh toán.
   - `CardManagementScreen`: Quản lý danh sách thẻ thanh toán giả lập (Visa, Mastercard, JCB), thêm thẻ mới, đặt thẻ mặc định.
8. **Tab 5: Tài khoản (Account / Settings):**
   - `SettingsScreen`: Hồ sơ người dùng, sửa tên, gửi xác minh email, đổi giao diện Sáng/Tối/Hệ thống, đổi ngôn ngữ Việt/Anh, cài đặt nhắc nhở đỗ xe, đăng xuất an toàn (dọn dẹp token FCM).
   - `ChangePasswordScreen`: Đổi mật khẩu tài khoản.
   - `VehicleListScreen`: Quản lý danh sách phương tiện, chọn xe mặc định, xóa xe.
   - `AddVehicleScreen`: Thêm phương tiện mới kèm preview chuẩn hóa biển số Việt Nam thời gian thực.
   - `InboxScreen`: Hộp thư thông báo trong app, đánh dấu đã đọc, chạm để chuyển tới màn hình tương ứng.

---

## 3. Chạy Unit Test kiểm thử Hợp đồng (Contracts)
Chạy bộ test JUnit đọc trực tiếp từ `contracts/fee_test_cases.json` và `contracts/plate_test_cases.json`:
```powershell
cd android-app
./gradlew testDebugUnitTest
```

