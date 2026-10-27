#include "DisplayManager.h"

DisplayManager::DisplayManager()
    : lcd(I2C_ADDR_LCD, 16, 2),
      oled(U8G2_R0, /* reset=*/ U8X8_PIN_NONE),
      eventMsgTimestamp(0),
      showingEventMsg(false),
      activeEvent(GATE_EVENT_NONE),
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
    updateLcd(totalAvail, lastEvent);

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

void DisplayManager::updateLcd(uint8_t totalAvail, GateEvent lastEvent) {
    char targetLine1[17] = " SMART PARKING  ";
    char targetLine2[17];

    unsigned long now = millis();

    // Bắt sự kiện mới từ cổng
    if (lastEvent != GATE_EVENT_NONE) {
        showingEventMsg = true;
        activeEvent = lastEvent;
        eventMsgTimestamp = now;
    }

    // Kiểm tra hết thời gian hiển thị thông điệp tạm thời
    if (showingEventMsg && (now - eventMsgTimestamp >= LCD_MSG_DURATION_MS)) {
        showingEventMsg = false;
        activeEvent = GATE_EVENT_NONE;
    }

    if (showingEventMsg) {
        switch (activeEvent) {
            case GATE_EVENT_CAR_ENTERING:
                strncpy(targetLine2, " MOI VAO...     ", sizeof(targetLine2));
                break;
            case GATE_EVENT_CAR_EXITING:
                strncpy(targetLine2, " TAM BIET!      ", sizeof(targetLine2));
                break;
            case GATE_EVENT_BLOCKED_FULL:
                strncpy(targetLine2, " BAI DA DAY!    ", sizeof(targetLine2));
                break;
            case GATE_EVENT_TIMEOUT:
                strncpy(targetLine2, " DONG BARIE...  ", sizeof(targetLine2));
                break;
            default:
                snprintf(targetLine2, sizeof(targetLine2), " Trong: %d/4 [OK] ", totalAvail);
                break;
        }
    } else {
        if (totalAvail == 0) {
            strncpy(targetLine2, " BAI DA DAY!    ", sizeof(targetLine2));
        } else {
            snprintf(targetLine2, sizeof(targetLine2), " Trong: %d/4 [OK] ", totalAvail);
        }
    }

    showLcdMessage(targetLine1, targetLine2);
}

void DisplayManager::drawArrowRight(int startX, int midY) {
    // Thân ngang mũi tên (dày 5px)
    oled.drawBox(startX, midY - 2, 18, 5);
    // Đầu tam giác nhọn hướng sang Phải
    oled.drawTriangle(startX + 18, midY - 7,
                      startX + 18, midY + 7,
                      startX + 28, midY);
}

void DisplayManager::drawArrowStraightRight(int stemX, int startY, int turnY, int endX) {
    // Thân dọc đi thẳng lên (dày 5px)
    oled.drawBox(stemX, turnY, 5, startY - turnY + 1);
    // Nhánh ngang rẽ sang phải (dày 5px)
    oled.drawBox(stemX, turnY, endX - stemX, 5);
    // Đầu tam giác nhọn hướng sang Phải
    oled.drawTriangle(endX, turnY - 5,
                      endX, turnY + 9,
                      endX + 10, turnY + 2);
}

void DisplayManager::updateOled(uint8_t availA, uint8_t availB) {
    oled.clearBuffer();

    // 1. Đường kẻ khung giao diện (Chia 2 cột đối xứng)
    oled.drawHLine(0, 14, 128);  // Phân cách tiêu đề
    oled.drawVLine(63, 0, 64);   // Phân cách cột Khu A và Khu B
    oled.drawHLine(0, 47, 128);  // Phân cách vùng số slot

    // 2. Tiêu đề cột
    oled.setFont(u8g2_font_6x12_tr);
    oled.drawStr(17, 11, "KHU A");
    oled.drawStr(81, 11, "KHU B");

    // 3. Đồ họa Mũi tên chỉ hướng theo sơ đồ sa hình
    // Khu A: Mũi tên Rẽ Phải (luôn hiển thị, kể cả khi 0/2)
    drawArrowRight(18, 30);

    // Khu B: Mũi tên Đi thẳng rồi rẽ Phải (luôn hiển thị, kể cả khi 0/2)
    drawArrowStraightRight(82, 41, 23, 104);

    // 4. Số lượng slot khả dụng [ X / 2 ]
    oled.setFont(u8g2_font_7x14B_tr);

    char strA[12];
    snprintf(strA, sizeof(strA), "[ %d/2 ]", availA);
    oled.drawStr(11, 61, strA);

    char strB[12];
    snprintf(strB, sizeof(strB), "[ %d/2 ]", availB);
    oled.drawStr(75, 61, strB);

    // Đẩy dữ liệu ra màn hình OLED
    oled.sendBuffer();
}
