import * as Network from 'expo-network';

function fetchWithTimeout(url: string, timeout = 800): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject("timeout"), timeout);

    fetch(url)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function scanNetwork(onFound: (ip: string) => void) {
  console.log("🔍 SCAN BAŞLADI");

  const localIP = await Network.getIpAddressAsync();
  console.log("📡 LOCAL IP:", localIP);

  if (!localIP) return;

  const baseIP = localIP.substring(0, localIP.lastIndexOf('.') + 1);
  console.log("🌐 BASE IP:", baseIP);

  let found = false;

  const requests = [];

  for (let i = 1; i < 255; i++) {
    const ip = baseIP + i;

    const req = fetchWithTimeout(`http://${ip}/whoami`, 800)
      .then(async (res) => {
        const response = res as Response;
        const text = await response.text();

        console.log(`CHECK ${ip}:`, text);

        try {
          const data = JSON.parse(text);

          if (data.device === "esp32-light") {
            console.log("✅ FOUND:", ip);
            found = true;
            onFound(ip);
          }
        } catch {}
      })
      .catch(() => {});

    requests.push(req);
  }

  await Promise.all(requests);

  if (!found) {
    console.log("❌ CİHAZ BULUNAMADI");
  }

  console.log("🏁 SCAN BİTTİ");
}