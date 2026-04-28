import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function ControlScreen({ ip }: { ip: string }) {
  const [isOn, setIsOn] = useState(false);

  const toggle = async () => {
    const path = isOn ? "/led/off" : "/led/on";

    try {
      await fetch(`http://${ip}${path}`);
      setIsOn(!isOn);
    } catch {
      console.log("Hata");
    }
  };

  return (
    <View style={{ marginTop: 100, alignItems: 'center', gap: 20 }}>
      <Text>IP: {ip}</Text>

      <TouchableOpacity
        onPress={toggle}
        style={{
          backgroundColor: isOn ? '#22c55e' : '#ef4444',
          padding: 20,
          borderRadius: 10
        }}
      >
        <Text style={{ color: 'white' }}>
          {isOn ? "AÇIK" : "KAPALI"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}