import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function seedData() {
  console.log("🚀 Bắt đầu nạp dữ liệu Seed Data cho hệ thống Bãi đỗ xe...");

  // 1. Tạo Bãi Live (lot_live_01) kết nối phần cứng Repo 1
  const liveLotRef = db.collection("lots").doc("lot_live_01");
  await liveLotRef.set({
    name: "Bãi đỗ Live Thông Minh A-B (Trạm ESP32)",
    address: "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
    location: new admin.firestore.GeoPoint(21.005, 105.843),
    photos: [
      "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    ],
    isLive: true,
    deviceId: "ESP32_STATION_01",
    deviceOnline: true,
    totalSlots: 4,
    availableSlots: 4,
    pricePerBlock: 5000,
    blockMinutes: 30,
    graceMinutes: 0,
    depositAmount: 5000,
    freeCancelMinutes: 2,
    holdDurationMinutes: 15,
    maxExtendCount: 1,
    vehicleTypes: ["car"],
    hasRoof: true,
    hasEv: true,
    openHours: "00:00 - 24:00",
    rating: 4.9,
    ratingCount: 128,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 4 Slot thực tế của bãi Live
  const slots = [
    { id: "A1", zone: "A", sensorOccupied: false, status: "available" },
    { id: "A2", zone: "A", sensorOccupied: false, status: "available" },
    { id: "B1", zone: "B", sensorOccupied: false, status: "available" },
    { id: "B2", zone: "B", sensorOccupied: false, status: "available" },
  ];

  for (const s of slots) {
    await liveLotRef.collection("slots").doc(s.id).set({
      zone: s.zone,
      sensorOccupied: s.sensorOccupied,
      status: s.status,
      reservationId: null,
      sessionId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log("✅ Đã tạo bãi Live: lot_live_01 với 4 slots: A1, A2, B1, B2");

  // 2. Tạo 6 Bãi Mock vệ tinh
  const mockLots = [
    {
      id: "lot_mock_01",
      name: "Bãi xe Vincom Mega Mall Thảo Điền",
      address: "161 Xa Lộ Hà Nội, P. Thảo Điền, TP. Thủ Đức, TP.HCM",
      location: new admin.firestore.GeoPoint(10.803, 106.74),
      photos: [
        "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80",
      ],
      totalSlots: 50,
      availableSlots: 24,
      pricePerBlock: 6000,
      blockMinutes: 30,
      hasRoof: true,
      hasEv: true,
      rating: 4.8,
    },
    {
      id: "lot_mock_02",
      name: "Bãi đỗ tòa nhà Bitexco Financial Tower",
      address: "2 Hải Triều, P. Bến Nghé, Quận 1, TP.HCM",
      location: new admin.firestore.GeoPoint(10.771, 106.704),
      photos: [
        "https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80",
      ],
      totalSlots: 40,
      availableSlots: 8,
      pricePerBlock: 10000,
      blockMinutes: 30,
      hasRoof: true,
      hasEv: false,
      rating: 4.6,
    },
    {
      id: "lot_mock_03",
      name: "Bãi xe Trung tâm Crescent Mall",
      address: "101 Tôn Dật Tiên, P. Tân Phú, Quận 7, TP.HCM",
      location: new admin.firestore.GeoPoint(10.718, 106.72),
      photos: [
        "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80",
      ],
      totalSlots: 60,
      availableSlots: 35,
      pricePerBlock: 5000,
      blockMinutes: 30,
      hasRoof: true,
      hasEv: true,
      rating: 4.7,
    },
    {
      id: "lot_mock_04",
      name: "Bãi đỗ Nhà ga Quốc nội Tân Sơn Nhất",
      address: "Trường Sơn, P. 2, Quận Tân Bình, TP.HCM",
      location: new admin.firestore.GeoPoint(10.818, 106.666),
      photos: [
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80",
      ],
      totalSlots: 100,
      availableSlots: 15,
      pricePerBlock: 8000,
      blockMinutes: 30,
      hasRoof: false,
      hasEv: false,
      rating: 4.2,
    },
    {
      id: "lot_mock_05",
      name: "Bãi xe Saigon Centre & Takashimaya",
      address: "65 Lê Lợi, P. Bến Nghé, Quận 1, TP.HCM",
      location: new admin.firestore.GeoPoint(10.773, 106.701),
      photos: [
        "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&w=800&q=80",
      ],
      totalSlots: 30,
      availableSlots: 6,
      pricePerBlock: 12000,
      blockMinutes: 30,
      hasRoof: true,
      hasEv: true,
      rating: 4.9,
    },
    {
      id: "lot_mock_06",
      name: "Bãi đỗ Aeon Mall Tân Phú Celadon",
      address: "30 Bờ Bao Tân Thắng, P. Sơn Kỳ, Q. Tân Phú, TP.HCM",
      location: new admin.firestore.GeoPoint(10.801, 106.616),
      photos: [
        "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80",
      ],
      totalSlots: 80,
      availableSlots: 48,
      pricePerBlock: 5000,
      blockMinutes: 30,
      hasRoof: true,
      hasEv: false,
      rating: 4.5,
    },
  ];

  for (const m of mockLots) {
    await db.collection("lots").doc(m.id).set({
      name: m.name,
      address: m.address,
      location: m.location,
      photos: m.photos,
      isLive: false,
      deviceId: `MOCK_DEV_${m.id}`,
      deviceOnline: true,
      totalSlots: m.totalSlots,
      availableSlots: m.availableSlots,
      pricePerBlock: m.pricePerBlock,
      blockMinutes: m.blockMinutes,
      graceMinutes: 0,
      depositAmount: 5000,
      freeCancelMinutes: 2,
      holdDurationMinutes: 15,
      maxExtendCount: 1,
      vehicleTypes: ["car"],
      hasRoof: m.hasRoof,
      hasEv: m.hasEv,
      openHours: "07:00 - 23:00",
      rating: m.rating,
      ratingCount: 85,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log("✅ Đã tạo 6 bãi mock vệ tinh thành công.");

  console.log("🎉 Hoàn tất nạp Seed Data!");
}

seedData().catch(console.error);

