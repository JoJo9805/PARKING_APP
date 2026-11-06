#ifndef CAM_CONFIG_H
#define CAM_CONFIG_H

#include <Arduino.h>
#include "esp_camera.h"
#include "common_network.h"

// ==========================================
// PINMAP BOARD AI-THINKER ESP32-CAM (OV2640)
// ==========================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Đèn Flash LED tích hợp trên board ESP32-CAM
#define PIN_CAM_FLASH_LED  4

// ==========================================
// CẤU HÌNH KHUNG HÌNH & CHỤP ẢNH
// ==========================================
#define CAM_FRAME_SIZE         FRAMESIZE_SVGA // 800x600 (phù hợp nhận diện biển số)
#define CAM_JPEG_QUALITY       12             // 10-63 (số càng nhỏ chất lượng càng cao)
#define CAM_FB_COUNT           2              // Số bộ đệm frame (yêu cầu PSRAM)
#define CAM_CAPTURE_FRAMES     2              // Số frame chụp gửi mỗi lượt request
#define CAM_FLASH_WARMUP_MS    150            // Thời gian bật đèn trước khi chụp để ổn định sáng
#define CAM_FRAME_INTERVAL_MS  150            // Khoảng nghỉ giữa 2 frame chụp liên tiếp

#endif // CAM_CONFIG_H

