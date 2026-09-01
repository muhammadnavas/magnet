import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";

export function useBackendStatus(autoCheck = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [latency, setLatency] = useState(null);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    const start = Date.now();
    try {
      // 45s timeout to allow Render free instances to cold-start
      const res = await api.get("/health", { timeout: 45000 });
      const elapsed = Date.now() - start;
      if (res.data && res.data.status === "ok") {
        setIsConnected(true);
        setLatency(elapsed);
      } else {
        setIsConnected(false);
        setLatency(null);
      }
    } catch (e) {
      setIsConnected(false);
      setLatency(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (autoCheck) {
      checkConnection();
      const interval = setInterval(checkConnection, 30000); // Auto ping every 30s
      return () => clearInterval(interval);
    }
  }, [autoCheck, checkConnection]);

  return { isConnected, isChecking, latency, checkConnection };
}

export default useBackendStatus;
