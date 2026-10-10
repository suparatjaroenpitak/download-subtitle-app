import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerTitleStyle: { fontWeight: "bold" } }}>
        <Stack.Screen name="index" options={{ title: "Universal Transcriber" }} />
        <Stack.Screen name="editor" options={{ title: "Transcript Editor" }} />
      </Stack>
    </>
  );
}
