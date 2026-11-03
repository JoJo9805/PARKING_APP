#ifndef PARKING_NETWORK_CLIENT_H
#define PARKING_NETWORK_CLIENT_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "ParkingMonitor.h"
#include "GateController.h"

class ParkingNetworkClient {
public:
    ParkingNetworkClient();

    // Khởi tạo Wi-Fi (nếu ENABLE_WIFI = true)
    void begin();

    // Cập nhật và gửi telemetry định kỳ non-blocking
    void update(const ParkingMonitor& parking, const GateController& gate);

    // Kiểm tra trạng thái kết nối
    bool isConnected() const;

private:
    unsigned long lastTelemetryTime;

    void sendTelemetry(const ParkingMonitor& parking, const GateController& gate);
};

#endif // PARKING_NETWORK_CLIENT_H

