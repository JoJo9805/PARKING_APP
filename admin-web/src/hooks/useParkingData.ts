import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
} from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import {
  Lot,
  Slot,
  GateEvent,
  Session,
  Reservation,
  Transaction,
  UserAccount,
  Device,
  DeviceCommand,
} from "../types";

export function useLot(lotId = "lot_live_01") {
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "lots", lotId),
      (snap) => {
        if (snap.exists()) {
          setLot({ id: snap.id, ...(snap.data() as any) });
        }
        setLoading(false);
      },
      (err) => {
        console.error("Lỗi khi theo dõi lot:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [lotId]);

  const updateConfig = async (newConfig: Partial<Lot>) => {
    await updateDoc(doc(db, "lots", lotId), newConfig as any);
  };

  return { lot, loading, updateConfig };
}

export function useSlots(lotId = "lot_live_01") {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "lots", lotId, "slots"),
      (snap) => {
        const list: Slot[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        list.sort((a, b) => a.id.localeCompare(b.id));
        setSlots(list);
        setLoading(false);
      },
      (err) => {
        console.error("Lỗi khi theo dõi slots:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [lotId]);

  return { slots, loading };
}

export function useGateEvents(lotId = "lot_live_01", max = 50) {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "gateEvents"),
      where("lotId", "==", lotId),
      orderBy("serverTs", "desc"),
      limit(max)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: GateEvent[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setEvents(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Thử fallback không index cho gateEvents:", err.message);
        // Fallback đơn giản nếu index chưa kịp build trên dev
        const fallbackQuery = query(collection(db, "gateEvents"), limit(max));
        onSnapshot(fallbackQuery, (fSnap) => {
          const list: GateEvent[] = [];
          fSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          setEvents(list);
          setLoading(false);
        });
      }
    );
    return () => unsub();
  }, [lotId, max]);

  return { events, loading };
}

export function useSessions(max = 50) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("entryTime", "desc"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Session[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.error("Lỗi khi theo dõi sessions:", err);
        const fallbackQ = query(collection(db, "sessions"), limit(max));
        onSnapshot(fallbackQ, (fSnap) => {
          const list: Session[] = [];
          fSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          setSessions(list);
          setLoading(false);
        });
      }
    );
    return () => unsub();
  }, [max]);

  return { sessions, loading };
}

export function useReservations(max = 50) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Reservation[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setReservations(list);
        setLoading(false);
      },
      () => {
        const fallbackQ = query(collection(db, "reservations"), limit(max));
        onSnapshot(fallbackQ, (fSnap) => {
          const list: Reservation[] = [];
          fSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          setReservations(list);
          setLoading(false);
        });
      }
    );
    return () => unsub();
  }, [max]);

  return { reservations, loading };
}

export function useUsers(max = 50) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"), limit(max));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserAccount[] = [];
      snap.forEach((d) => list.push({ uid: d.id, ...(d.data() as any) }));
      setUsers(list);
      setLoading(false);
    });
    return () => unsub();
  }, [max]);

  return { users, loading };
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "devices"), (snap) => {
      const list: Device[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setDevices(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { devices, loading };
}

export function useDeviceCommands(max = 20) {
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "deviceCommands"), orderBy("createdAt", "desc"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: DeviceCommand[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setCommands(list);
        setLoading(false);
      },
      () => {
        const fbQ = query(collection(db, "deviceCommands"), limit(max));
        onSnapshot(fbQ, (fSnap) => {
          const list: DeviceCommand[] = [];
          fSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          setCommands(list);
          setLoading(false);
        });
      }
    );
    return () => unsub();
  }, [max]);

  return { commands, loading };
}

export function useTransactions(max = 100) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setTransactions(list);
        setLoading(false);
      },
      () => {
        const fbQ = query(collection(db, "transactions"), limit(max));
        onSnapshot(fbQ, (fSnap) => {
          const list: Transaction[] = [];
          fSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          setTransactions(list);
          setLoading(false);
        });
      }
    );
    return () => unsub();
  }, [max]);

  return { transactions, loading };
}

/**
 * Hook tải URL ảnh từ Firebase Storage hoặc trả về URL trực tiếp.
 */
export function useStorageUrl(imagePathOrUrl?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imagePathOrUrl) {
      setUrl(null);
      return;
    }

    if (imagePathOrUrl.startsWith("http://") || imagePathOrUrl.startsWith("https://") || imagePathOrUrl.startsWith("data:")) {
      setUrl(imagePathOrUrl);
      return;
    }

    // Nếu là đường dẫn tương đối trong Storage (ví dụ "gate/2026-11-12/...jpg")
    setLoading(true);
    const storageRef = ref(storage, imagePathOrUrl);
    getDownloadURL(storageRef)
      .then((downloadUrl) => {
        setUrl(downloadUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.warn(`Không thể tải URL ảnh từ storage (${imagePathOrUrl}):`, err.message);
        setUrl(null);
        setLoading(false);
      });
  }, [imagePathOrUrl]);

  return { url, loading };
}

