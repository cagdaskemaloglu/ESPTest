import { useState } from 'react';
import { scanNetwork } from '../services/networkScanner';

export function useDeviceDiscovery() {
  const [foundIP, setFoundIP] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const startScan = async () => {
    setScanning(true);
    setFoundIP(null);

    await scanNetwork((ip) => {
      setFoundIP(ip);
    });

    setScanning(false);
  };

  return {
    foundIP,
    scanning,
    startScan,
  };
}