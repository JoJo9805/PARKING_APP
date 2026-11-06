#include <Arduino.h>
#include "cam_config.h"

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println();
    Serial.println(F("=================================================="));
    Serial.println(F("   ESP32-CAM (OV2640) - Parking Camera Node      "));
    Serial.println(F("=================================================="));

    pinMode(PIN_CAM_FLASH_LED, OUTPUT);
    digitalWrite(PIN_CAM_FLASH_LED, LOW); // Tắt đèn flash mặc định

    Serial.printf("[CAM] Device ID: %s\n", DEVICE_ID_CAM);
    Serial.printf("[CAM] Broker Target: %s:%d\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    Serial.printf("[CAM] Recognize API: %s\n", EDGE_RECOGNIZE_URL);
    Serial.println(F("[CAM] Module ready for Phase S2 logic integration."));
}

void loop() {
    // Phase S2 sẽ triển khai:
    // 1. WiFi & MQTT reconnect non-blocking
    // 2. Lắng nghe topic TOPIC_GATE_REQUEST
    // 3. Chụp frame OV2640 và gửi multipart/form-data
    delay(1000);
}

