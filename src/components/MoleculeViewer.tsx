// src/components/MoleculeViewer.tsx — interactive 3D structure (3Dmol.js inside a WebView)
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildViewerHtml } from "../lib/viewerHtml";

type Props = {
  fileUrl: string;
  ligandCode?: string;
  chain?: string;
  ligandLabel?: string; // e.g. "tagged serine"; button reads "Zoom to <label>"
  height?: number;
};

export default function MoleculeViewer({ fileUrl, ligandCode, chain, ligandLabel, height = 360 }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const webref = useRef<WebView>(null);
  const html = useMemo(
    () => buildViewerHtml(fileUrl, ligandCode ?? "", chain ?? ""),
    [fileUrl, ligandCode, chain]
  );

  const run = (js: string) => webref.current?.injectJavaScript(js + "; true;");

  return (
    <View style={styles.container}>
      <View style={[styles.viewer, { height }]}>
        <WebView
          ref={webref}
          originWhitelist={["*"]}
          source={{ html }}
          style={{ flex: 1, backgroundColor: "#0b1020" }}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          onMessage={(e) => {
            const msg = String(e.nativeEvent.data);
            if (msg === "rendered") setStatus("ready");
            else if (msg.startsWith("error:")) { setStatus("error"); setError(msg.slice(6)); }
            else if (msg.startsWith("ligatoms:")) console.log("ligand atoms:", msg.slice(9));
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
        {ligandCode ? (
          <Pressable style={styles.btn} onPress={() => run("window.mlx.refocus()")}>
            <Text style={styles.btnText}>Zoom to {ligandLabel ?? "drug"}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.btn} onPress={() => run("window.mlx.wholeProtein()")}>
          <Text style={styles.btnText}>Whole protein</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        {status === "error" ? `Error: ${error}` : "Drag to rotate · pinch to zoom · use the buttons to re-centre"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  viewer: { borderRadius: 16, overflow: "hidden", backgroundColor: "#0b1020" },
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 8 },
  overlayText: { color: "white" },
  row: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, backgroundColor: "#22306b", padding: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { color: "white", fontWeight: "600", textAlign: "center" },
  note: { color: "#9aa4c7", fontSize: 12, textAlign: "center" },
});
