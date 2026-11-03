xác định bằng biển số xe  
camera \+ học máy ptich ảnh  
app:  
không thẻ   
sử dụng dl từ camera để xác định chỗ đỗ, biển số   
tìm chỗ đỗ (gps như gg)   
có xác định giờ vào ra , có thông báo  
thu theo lượt   
thanh toán kết nối thẻ, có hóa đơn trên app   
cho phép chọn chỗ đỗ, app chỉ dẫn đến chỗ đỗ   
xem lịch sử 

App:  
Chức Năng Chính

Đăng Nhập

Quản lý phương tiện: thêm nhiều xe, mỗi xe gắn một biển số (khớp với nhận diện biển số ở backend), chọn xe mặc định. Đây là cầu nối quan trọng giữa app và camera ở bãi.

Đặt chỗ trước (reservation): giữ chỗ trong khoảng thời gian nhất định (ví dụ 15 phút), có đếm ngược và tự huỷ nếu không đến.

Điều hướng đến bãi đỗ: tích hợp bản đồ (Google Maps / OpenStreetMap), hiển thị khoảng cách, thời gian di chuyển, chỉ đường.

Bộ lọc và sắp xếp bãi đỗ: theo giá, khoảng cách, số chỗ trống, loại xe (ô tô, xe máy), có mái che, có sạc xe điện.

Xem chi tiết bãi đỗ: giờ mở cửa, bảng giá, ảnh, đánh giá, số chỗ trống theo thời gian thực.

Phiên đỗ xe hiện tại: màn hình hiển thị xe đang đỗ, thời gian đã đỗ và số tiền tạm tính theo thời gian thực.

Lịch sử và hoá đơn chi tiết: lọc theo tháng, xem biển số, giờ vào/ra, phí, phương thức thanh toán; thống kê chi tiêu theo tháng bằng biểu đồ.

Quản lý ví/thẻ: thêm, xoá thẻ, nạp tiền vào ví nội bộ, đặt phương thức mặc định.

 

Optional

Lưu vị trí xe đã đỗ: với bãi lớn nhiều tầng, app ghi lại khu vực/tầng/ô đỗ để bạn tìm lại xe, kèm ghi chú hoặc ảnh chụp.

Nhắc giờ: thông báo trước khi hết thời gian đặt trước hoặc khi đỗ quá lâu, kèm gia hạn nhanh trong app.

Yêu thích bãi đỗ: lưu các bãi hay đến để truy cập nhanh.

Vé tháng / gói đăng ký: mua gói đỗ xe theo tháng với giá ưu đãi.

Khuyến mãi và mã giảm giá: nhập mã, tích điểm sau mỗi lượt đỗ.

Đánh giá và phản hồi: chấm sao bãi đỗ, báo cáo sự cố (tính phí sai, không nhận diện được biển số).

Đăng nhập an toàn: đăng nhập bằng OTP, sinh trắc học (vân tay/Face ID) để xác nhận thanh toán.

Chế độ tối, đa ngôn ngữ (Việt/Anh).

App Stack

| Nhóm | Công nghệ | Lý do chọn |
| ----- | ----- | ----- |
| Ngôn ngữ, UI | Kotlin, Jetpack Compose | Chuẩn hiện tại của Android, UI tự cập nhật theo dữ liệu realtime |
| Kiến trúc | MVVM, Repository, Hilt | Tách lớp rõ ràng, dễ bảo trì, dễ kiểm thử |
| Dữ liệu | Retrofit, Room, Coroutines/Flow | Gọi API, cache offline, xử lý bất đồng bộ |
| Bản đồ | Google Maps SDK / OSM, Fused Location | Hiển thị bãi, định vị, chỉ đường |
| Thông báo | Firebase Cloud Messaging | Báo xe vào/ra bãi |
| Bảo mật | BiometricPrompt, EncryptedSharedPreferences | Xác nhận thanh toán, bảo vệ token |

