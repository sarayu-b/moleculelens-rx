// app/index.tsx — 3D prototype screen
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildViewerHtml } from "../lib/viewerHtml";

export default function Home() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const webref = useRef<WebView>(null);

  const run = (js: string) => webref.current?.injectJavaScript(js + "; true;");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ibuprofen inside COX-2</Text>
      <Text style={styles.sub}>PDB 4PH9 · mouse COX-2 (structure is from a mouse protein) · educational only</Text>

      <View style={styles.viewer}>
        <WebView
          ref={webref}
          originWhitelist={["*"]}
          source={{ html: buildViewerHtml("4PH9", "IBP", "A") }}
          style={{ flex: 1, backgroundColor: "#0b1020" }}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          onMessage={(e) => {
            const msg = String(e.nativeEvent.data);
            if (msg === "rendered") setStatus("ready");
            else if (msg.startsWith("error:")) { setStatus("error"); setError(msg.slice(6)); }
          }}
        />
        {status === "loading" && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>Loading structure…</Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => run("window.mlx.toggleSurface()")}>
          <Text style={styles.btnText}>Ribbon / Surface</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => run("window.mlx.refocus()")}>
          <Text style={styles.btnText}>Zoom to drug</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => run("window.mlx.wholeProtein()")}>
          <Text style={styles.btnText}>Whole protein</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        {status === "error" ? `Error: ${error}` : "Drag to rotate · pinch to zoom · two-finger drag to pan"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05070f", padding: 12, gap: 8 },
  title: { color: "white", fontSize: 20, fontWeight: "700", marginTop: 8 },
  sub: { color: "#9aa4c7", fontSize: 12 },
  viewer: { flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#0b1020" },
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 8 },
  overlayText: { color: "white" },
  row: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, backgroundColor: "#22306b", padding: 12, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "600" },
  note: { color: "#9aa4c7", fontSize: 12, textAlign: "center", marginBottom: 8 },
});
