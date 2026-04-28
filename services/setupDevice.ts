export async function setupDevice(ssid: string, password: string) {
  try {
    const res = await fetch(
      `http://192.168.4.1/setup?s=${ssid}&p=${password}`
    );

    return res.ok;
  } catch {
    return false;
  }
}