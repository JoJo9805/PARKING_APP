#include "DisplayManager.h"

DisplayManager::DisplayManager()
    : lcd(I2C_ADDR_LCD, 16, 2),
      oled(U8G2_R0, /* reset=*/ U8X8_PIN_NONE),
      eventMsgTimestamp(0),
      showingEventMsg(false),
      activeEvent(GATE_EVENT_NONE),
      lastHandledEvent(GATE_EVENT_NONE),
      cachedAvailA(255),
      cachedAvailB(255),
      lastOledRefreshTime(0) {
    currentLcdLine1[0] = '\0';
    currentLcdLine2[0] = '\0';
}

void DisplayManager::begin() {
    // Khởi tạo LCD 1602 (I2C 0x27)
    lcd.init();
    lcd.backlight();
    showLcdMessage(" SMART PARKING  ", " Khoi dong...   ");

    // Khởi tạo OLED 1.3" SH1106 (I2C 0x3C)
    oled.begin();
    oled.clearBuffer();
    oled.setFont(u8g2_font_6x12_tr);
    oled.drawStr(22, 25, "SMART PARKING");
    oled.drawStr(20, 45, "KHOI DONG HE THONG");
    oled.sendBuffer();

    Serial.println(F("[DisplayManager] LCD 1602 & OLED SH1106 ready."));
}

void DisplayManager::update(uint8_t totalAvail, uint8_t availA, uint8_t availB,
                            bool barrierOpen, GateEvent lastEvent) {
    (void)barrierOpen; // Tránh warning unused

    // 1. Cập nhật màn hình LCD 1602
    updateLcd(totalAvail, availA, availB, lastEvent);

    // 2. Cập nhật màn hình OLED SH1106 non-blocking
    unsigned long now = millis();
    bool dataChanged = (availA != cachedAvailA || availB != cachedAvailB);
    bool timeToRefresh = (now - lastOledRefreshTime >= DISPLAY_REFRESH_MS);

    if (dataChanged || timeToRefresh) {
        lastOledRefreshTime = now;
        cachedAvailA = availA;
        cachedAvailB = availB;
        updateOled(availA, availB);
    }
}

void DisplayManager::showLcdMessage(const char* line1, const char* line2) {
    if (strcmp(line1, currentLcdLine1) != 0) {
        lcd.setCursor(0, 0);
        lcd.print(line1);
        strncpy(currentLcdLine1, line1, sizeof(currentLcdLine1) - 1);
        currentLcdLine1[sizeof(currentLcdLine1) - 1] = '\0';
    }
    if (strcmp(line2, currentLcdLine2) != 0) {
        lcd.setCursor(0, 1);
        lcd.print(line2);
        strncpy(currentLcdLine2, line2, sizeof(currentLcdLine2) - 1);
        currentLcdLine2[sizeof(currentLcdLine2) - 1] = '\0';
    }
}

void DisplayManager::updateLcd(uint8_t totalAvail, uint8_t availA, uint8_t availB, GateEvent lastEvent) {
    char targetLine1[17] = " SMART PARKING  ";
    char targetLine2[17];

    unsigned long now = millis();

    // 1. Bắt sự kiện mới từ cổng (Edge-Trigger: chỉ ghi nhận khi sự kiện mới xuất hiện)
    if (lastEvent != GATE_EVENT_NONE && lastEvent != lastHandledEvent) {
        showingEventMsg = true;
        activeEvent = lastEvent;
        eventMsgTimestamp = now;
        lastHandledEvent = lastEvent;
    }

    // 2. Hết thời gian hiển thị thông điệp tạm thời
    if (showingEventMsg && (now - eventMsgTimestamp >= LCD_MSG_DURATION_MS)) {
        // Riêng trường hợp xe bị chặn vì bãi đầy, giữ thông báo cho tới khi xe lùi đi
        if (lastEvent != GATE_EVENT_BLOCKED_FULL) {
            showingEventMsg = false;
            activeEvent = GATE_EVENT_NONE;
        }
    }

    // Reset cờ nhận diện sự kiện khi cổng đã rảnh và thông điệp tạm thời đã kết thúc
    if (!showingEventMsg && lastEvent == GATE_EVENT_NONE) {
        lastHandledEvent = GATE_EVENT_NONE;
    }

    // 3. Xử lý DÒNG 1: Tiêu đề mặc định hoặc Thông điệp sự kiện cổng tạm thời
    if (showingEventMsg) {
        switch (activeEvent) {
            case GATE_EVENT_CAR_ENTERING:
                strncpy(targetLine1, " MOI VAO >>     ", sizeof(targetLine1));
                break;
            case GATE_EVENT_CAR_EXITING:
                strncpy(targetLine1, " TAM BIET <<    ", sizeof(targetLine1));
                break;
            case GATE_EVENT_BLOCKED_FULL:
                strncpy(targetLine1, " BAI DA DAY!    ", sizeof(targetLine1));
                break;
            case GATE_EVENT_TIMEOUT:
                strncpy(targetLine1, " DONG BARIE...  ", sizeof(targetLine1));
                break;
            default:
                strncpy(targetLine1, " SMART PARKING  ", sizeof(targetLine1));
                break;
        }
    } else {
        strncpy(targetLine1, " SMART PARKING  ", sizeof(targetLine1));
    }
    targetLine1[sizeof(targetLine1) - 1] = '\0';

    // 4. Xử lý DÒNG 2: LUÔN LUÔN hiển thị trạng thái vị trí chỗ trống thời gian thực (Real-time)
    if (totalAvail == 0) {
        strncpy(targetLine2, "Tr:0/4 (HET CHO)", sizeof(targetLine2));
    } else {
        // Định dạng 16 ký tự vừa vặn: "Tr:3/4 (A:1 B:2)"
        snprintf(targetLine2, sizeof(targetLine2), "Tr:%d/4 (A:%d B:%d)", totalAvail, availA, availB);
    }
    targetLine2[sizeof(targetLine2) - 1] = '\0';

    // Cập nhật lên LCD (chống nhấp nháy nhờ bộ đệm so sánh)
    showLcdMessage(targetLine1, targetLine2);
}

void DisplayManager::updateOled(uint8_t availA, uint8_t availB) {
    oled.clearBuffer();

    // 1. Đường kẻ khung phân chia giao diện:
    // Cột dọc giữa phân cách Khu B (Trái) và Khu A (Phải)
    oled.drawVLine(63, 0, 64);
    // Đường ngang phân cách Tiêu đề (y=16) và Tình trạng (y=42)
    oled.drawHLine(0, 16, 128);
    oled.drawHLine(0, 42, 128);

    // 2. Tiêu đề: TRÁI LÀ KHU B, PHẢI LÀ KHU A
    oled.setFont(u8g2_font_7x14B_tr);
    int wB = oled.getStrWidth("KHU B");
    oled.drawStr((63 - wB) / 2, 13, "KHU B");

    int wA = oled.getStrWidth("KHU A");
    oled.drawStr(64 + (63 - wA) / 2, 13, "KHU A");

    // 3. Số lượng chỗ trống khả dụng [ X / 2 ] ở giữa
    char strB[12];
    snprintf(strB, sizeof(strB), "[ %d/2 ]", availB);
    int wSlotB = oled.getStrWidth(strB);
    oled.drawStr((63 - wSlotB) / 2, 34, strB);

    char strA[12];
    snprintf(strA, sizeof(strA), "[ %d/2 ]", availA);
    int wSlotA = oled.getStrWidth(strA);
    oled.drawStr(64 + (63 - wSlotA) / 2, 34, strA);

    // 4. Tình trạng chỗ ở dòng dưới (CÒN CHỖ / HẾT CHỖ)
    oled.setFont(u8g2_font_6x12_tr);

    // Khu B (Bên trái)
    const char* statB = (availB > 0) ? "CON CHO" : "HET CHO";
    int wStatB = oled.getStrWidth(statB);
    int xStatB = (63 - wStatB) / 2;
    if (availB == 0) {
        // Nền đảo màu để cảnh báo hết chỗ nổi bật
        oled.drawBox(2, 46, 59, 15);
        oled.setDrawColor(0);
        oled.drawStr(xStatB, 58, statB);
        oled.setDrawColor(1);
    } else {
        oled.drawStr(xStatB, 58, statB);
    }

    // Khu A (Bên phải)
    const char* statA = (availA > 0) ? "CON CHO" : "HET CHO";
    int wStatA = oled.getStrWidth(statA);
    int xStatA = 64 + (63 - wStatA) / 2;
    if (availA == 0) {
        // Nền đảo màu để cảnh báo hết chỗ nổi bật
        oled.drawBox(66, 46, 59, 15);
        oled.setDrawColor(0);
        oled.drawStr(xStatA, 58, statA);
        oled.setDrawColor(1);
    } else {
        oled.drawStr(xStatA, 58, statA);
    }

    // Đẩy dữ liệu ra màn hình OLED
    oled.sendBuffer();
}
