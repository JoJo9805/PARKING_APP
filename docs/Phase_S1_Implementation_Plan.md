# IMPLEMENTATION PLAN — PHASE S1: CẤU TRÚC MULTI-ENV PLATFORMIO & MOSQUITTO BROKER
**Dự án:** `iot-parking-station` (Repo 1)  
**Tham chiếu:** `docs/Plan_Repo1_IoT_And_Edge_Backend.md`, `docs/Repo1_Execution_Plan.md`  
**Ngày tạo:** 2026-11-06

---

## 1. MỤC TIÊU CỦA PHASE S1

1. **Tái cấu trúc mã nguồn Firmware thành Multi-Environment PlatformIO:**
   - Tách thư mục `src/` thành `src/gate/` (cho mạch **NodeMCU ESP32 chính**) và `src/cam/` (cho mạch **AI-Thinker ESP32-CAM**) mà **không làm hỏng** bất kỳ logic đã chạy ổn định nào của Phase F1–F5.
   - Tạo header hợp đồng mạng dùng chung `include/common_network.h` chứa thông tin Wi-Fi, IP máy trạm Edge Server, tài khoản MQTT và 6 hằng số Topic chuẩn để cả 2 mạch dùng chung.
2. **Thiết lập hạ tầng Eclipse Mosquitto MQTT Broker (`edge-backend/mosquitto/`):**
   - Cấu hình `mosquitto.conf`, phân quyền `acl` chặt chẽ cho 3 client (`esp32_gate_01`, `esp32_cam_01`, `edge_server`), script tạo file mật khẩu `passwd` và `docker-compose.yml` để khởi chạy Broker bằng 1 lệnh.
3. **Cập nhật `.gitignore`:**
   - Bổ sung các file nhạy cảm/sinh tự động của Python, Docker, Mosquitto và Firebase Service Account (`edge-backend/.env`, `serviceAccountKey.json`, `__pycache__/`, `.venv/`, `mosquitto/data/`, `mosquitto/log/`, `mosquitto/passwd`).

---

## 2. DANH SÁCH FILE SẼ TẠO MỚI / CHỈNH SỬA / DI CHUYỂN

| Thao tác | Đường dẫn File | Mô tả chi tiết |
|:---:|:---|:---|
| **MOVE** | `src/*.cpp` → `src/gate/*.cpp` | Di chuyển 5 file `main.cpp`, `ParkingMonitor.cpp`, `GateController.cpp`, `DisplayManager.cpp`, `ParkingNetworkClient.cpp` vào `src/gate/`. |
| **NEW** | `include/common_network.h` | Định nghĩa Wi-Fi SSID/Password, `EDGE_SERVER_IP`, cổng MQTT (`1883`), cổng HTTP (`8000`), tài khoản MQTT của 2 mạch và 6 hằng số MQTT Topic. |
| **MODIFY** | `include/config.h` | Include `"common_network.h"`, giữ nguyên toàn bộ Pinmap & hằng số timing hiện có, bổ sung `GATE_AUTH_TIMEOUT_MS = 8000` chuẩn bị cho Phase S2. |
| **NEW** | `include/cam_config.h` | Định nghĩa Pinmap chuẩn cho board **AI-Thinker ESP32-CAM (OV2640)**, chân Flash LED (`GPIO 4`) và thông số khung hình SVGA. |
| **NEW** | `src/cam/main_cam.cpp` | Khung chương trình (`setup()` / `loop()`) cho ESP32-CAM include `common_network.h` và `cam_config.h` để đảm bảo `[env:esp32cam]` biên dịch thành công ngay ở Phase S1. |
| **MODIFY** | `platformio.ini` | Cấu hình 2 môi trường `[env:nodemcu-32s]` (`build_src_filter = +<gate/*> -<cam/*>`) và `[env:esp32cam]` (`build_src_filter = +<cam/*> -<gate/*>`, `board_build.partitions = huge_app.csv`). |
| **NEW** | `edge-backend/mosquitto/mosquitto.conf` | Cấu hình lắng nghe cổng `1883`, `allow_anonymous false`, bật persistence, trỏ tới `passwd` và `acl`. |
| **NEW** | `edge-backend/mosquitto/acl` | Phân quyền đọc/ghi từng topic cho `esp32_gate_01`, `esp32_cam_01` và `edge_server`. |
| **NEW** | `edge-backend/mosquitto/passwd.example` | File mẫu danh sách tài khoản MQTT kèm hướng dẫn/script lệnh `mosquitto_passwd` để băm mật khẩu. |
| **NEW** | `edge-backend/docker-compose.yml` | Khởi chạy dịch vụ `mosquitto` (`eclipse-mosquitto:2`) mount cấu hình, `data` và `log`. |
| **NEW** | `edge-backend/.env.example` | Biến môi trường mẫu cho Edge Server (MQTT credentials, `CAM_API_KEY`, `LOT_ID`, đường dẫn `GOOGLE_APPLICATION_CREDENTIALS`). |
| **MODIFY** | `.gitignore` | Bỏ qua `.venv/`, `__pycache__/`, `edge-backend/.env`, `*serviceAccount*.json`, `edge-backend/mosquitto/passwd`, `edge-backend/mosquitto/data/`, `edge-backend/mosquitto/log/`. |

---

## 3. THIẾT KẾ NỘI DUNG CHI TIẾT TỪNG FILE

### 3.1. File `platformio.ini`
```ini
[platformio]
default_envs = nodemcu-32s

[env]
platform = espressif32
framework = arduino
monitor_speed = 115200
lib_deps_common =
    bblanchon/ArduinoJson @ ^7.0.4
    knolleary/PubSubClient @ ^2.8

[env:nodemcu-32s]
board = nodemcu-32s
build_src_filter = +<gate/*> -<cam/*>
lib_deps =
    ${env.lib_deps_common}
    madhephaestus/ESP32Servo @ ^3.0.5
    marcoschwartz/LiquidCrystal_I2C @ ^1.1.4
    olikraus/U8g2 @ ^2.35.19

[env:esp32cam]
board = esp32cam
build_src_filter = +<cam/*> -<gate/*>
board_build.partitions = huge_app.csv
lib_deps =
    ${env.lib_deps_common}
```

### 3.2. File `include/common_network.h`
```cpp
#ifndef COMMON_NETWORK_H
#define COMMON_NETWORK_H

// ==========================================
// ĐỊNH DANH THIẾT BỊ TRONG HỆ THỐNG
// ==========================================
#define DEVICE_ID_GATE "ESP32_PARKING_01"
#define DEVICE_ID_CAM  "ESP32_CAM_01"

// ==========================================
// CẤU HÌNH WI-FI DÙNG CHUNG (GATE & CAM)
// ==========================================
#define ENABLE_WIFI   false            // Đổi thành true khi kết nối Wi-Fi thực tế
#define WIFI_SSID     "Your_WiFi_SSID"
#define WIFI_PASSWORD "Your_WiFi_Password"

// ==========================================
// ĐỊA CHỈ MÁY TRẠM EDGE SERVER (REPO 1)
// ==========================================
#define EDGE_SERVER_IP       "192.168.1.100"
#define MQTT_BROKER_HOST     EDGE_SERVER_IP
#define MQTT_BROKER_PORT     1883
#define MQTT_BUFFER_SIZE     1024
#define MQTT_RECONNECT_MS    5000

// Endpoint HTTP nhận ảnh biển số trên Edge Server (FastAPI)
#define EDGE_RECOGNIZE_URL   "http://" EDGE_SERVER_IP ":8000/recognize"
#define CAM_SHARED_API_KEY   "smart-parking-cam-secret-2026"

// ==========================================
// TÀI KHOẢN XÁC THỰC MQTT BROKER (MOSQUITTO)
// ==========================================
#define MQTT_USER_GATE       "esp32_gate_01"
#define MQTT_PASS_GATE       "gate_secret_2026"

#define MQTT_USER_CAM        "esp32_cam_01"
#define MQTT_PASS_CAM        "cam_secret_2026"

// ==========================================
// HỢP ĐỒNG 6 MQTT TOPICS CHUẨN
// ==========================================
#define TOPIC_STATE          "parking/ESP32_PARKING_01/state"
#define TOPIC_GATE_REQUEST   "parking/ESP32_PARKING_01/gate/request"
#define TOPIC_GATE_COMMAND   "parking/ESP32_PARKING_01/gate/command"
#define TOPIC_RESERVED       "parking/ESP32_PARKING_01/reserved"
#define TOPIC_GATE_STATUS    "parking/ESP32_PARKING_01/status"
#define TOPIC_CAM_STATUS     "parking/ESP32_CAM_01/status"

#endif // COMMON_NETWORK_H
```

### 3.3. File `include/cam_config.h` (Pinmap AI-Thinker ESP32-CAM)
- Định nghĩa đầy đủ các chân camera OV2640 (`PWDN_GPIO_NUM 32`, `RESET_GPIO_NUM -1`, `XCLK_GPIO_NUM 0`, `SIOD_GPIO_NUM 26`, `SIOC_GPIO_NUM 27`, `Y9..Y2`, `VSYNC 25`, `HREF 23`, `PCLK 22`).
- Định nghĩa chân đèn Flash LED: `#define PIN_CAM_FLASH_LED 4`.
- Định nghĩa thông số chụp: `CAM_FRAME_SIZE FRAMESIZE_SVGA` (`800x600`), `CAM_JPEG_QUALITY 12`, `CAM_FB_COUNT 2`, `CAM_CAPTURE_FRAMES 2`, `CAM_FLASH_WARMUP_MS 150`.

### 3.4. Cấu hình Mosquitto Broker (`edge-backend/mosquitto/`)

#### `edge-backend/mosquitto/mosquitto.conf`
```conf
persistence true
persistence_location /mosquitto/data/
log_dest stdout
log_type error
log_type warning
log_type notice
log_type information

listener 1883 0.0.0.0
allow_anonymous false
password_file /mosquitto/config/passwd
acl_file /mosquitto/config/acl
```

#### `edge-backend/mosquitto/acl`
```conf
# 1. Mạch ESP32 Chính (Gate & 4 Slots)
user esp32_gate_01
topic write parking/ESP32_PARKING_01/state
topic write parking/ESP32_PARKING_01/gate/request
topic write parking/ESP32_PARKING_01/status
topic read  parking/ESP32_PARKING_01/gate/command
topic read  parking/ESP32_PARKING_01/reserved

# 2. Mạch ESP32-CAM
user esp32_cam_01
topic write parking/ESP32_CAM_01/status
topic read  parking/ESP32_PARKING_01/gate/request

# 3. Edge Server (Python FastAPI Bridge)
user edge_server
topic readwrite parking/#
```

---

## 4. TIÊU CHÍ NGHIỆM THU PHASE S1 (VERIFICATION PLAN)

1. **Kiểm tra cấu trúc thư mục Firmware:**
   - `src/gate/` chứa đủ 5 file `.cpp` của ESP32 chính.
   - `src/cam/` chứa `main_cam.cpp`.
   - `include/` có đủ `common_network.h`, `config.h`, `cam_config.h`.
2. **Kiểm tra cấu trúc `edge-backend/`:**
   - Có đủ `mosquitto/mosquitto.conf`, `mosquitto/acl`, `mosquitto/passwd.example`, `docker-compose.yml` và `.env.example`.
3. **Kiểm tra tính tương thích ngược:**
   - Toàn bộ code hiện có của ESP32 chính giữ nguyên hành vi cục bộ, sẵn sàng chuyển sang bước nâng cấp logic MQTT ở **Phase S2**.

