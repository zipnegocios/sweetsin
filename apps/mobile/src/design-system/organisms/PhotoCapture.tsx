import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Modal, useWindowDimensions, View } from "react-native";
import { Text } from "../atoms/Text";
import { Touchable } from "../atoms/Touchable";
import { Button } from "../molecules/Button";
import { useTheme } from "../use-theme";

export type PhotoCaptureLabels = {
  title: string;
  guide: string;
  shoot: string;
  flip: string;
  cancel: string;
  grant: string;
  denied: string;
};

export type PhotoCaptureProps = {
  visible: boolean;
  labels: PhotoCaptureLabels;
  onCancel: () => void;
  /** Recibe el archivo tal como lo entrega la cámara (rectangular); quien llama lo recorta y reduce. */
  onCapture: (picture: { uri: string }) => void;
};

const absoluteFill = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Cámara dentro de la app con un círculo guía (la foto se muestra redonda). Frontal por defecto: es una selfie. */
export function PhotoCapture({ visible, labels, onCancel, onCapture }: PhotoCaptureProps) {
  const t = useTheme().components.capture;
  const { width } = useWindowDimensions();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);

  const side = width - t.padding * 2; // visor cuadrado a todo el ancho
  const guide = side * t.guideFraction;

  async function shoot() {
    if (!ready || shooting) return;
    setShooting(true);
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (picture) onCapture({ uri: picture.uri });
    } catch {
      // un disparo fallido deja la cámara lista para reintentar
    } finally {
      setShooting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.bg, padding: t.padding, gap: t.gap, justifyContent: "center" }}>
        <Text variant="title" color={t.fg} style={{ textAlign: "center" }}>
          {labels.title}
        </Text>

        {permission?.granted ? (
          <>
            <View style={{ width: side, aspectRatio: 1, alignSelf: "center", overflow: "hidden" }}>
              <CameraView ref={camera} style={{ flex: 1 }} facing={facing} mirror={facing === "front"} onCameraReady={() => setReady(true)} />
              <View pointerEvents="none" style={{ ...absoluteFill, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: guide, height: guide, borderRadius: guide / 2, borderWidth: t.guideWidth, borderColor: t.guide }} />
              </View>
            </View>
            <Text color={t.fg} style={{ textAlign: "center" }}>
              {labels.guide}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Button label={labels.cancel} variant="secondary" onPress={onCancel} />
              <Touchable
                onPress={shoot}
                disabled={!ready || shooting}
                accessibilityRole="button"
                accessibilityLabel={labels.shoot}
                style={{
                  width: t.shutterSize,
                  height: t.shutterSize,
                  borderRadius: t.shutterSize / 2,
                  borderWidth: t.shutterRing,
                  borderColor: t.fg,
                  backgroundColor: shooting || !ready ? t.bg : t.fg,
                }}
              />
              <Button
                label={labels.flip}
                variant="secondary"
                onPress={() => {
                  setReady(false);
                  setFacing((f) => (f === "front" ? "back" : "front"));
                }}
              />
            </View>
          </>
        ) : (
          <>
            <Text color={t.fg} style={{ textAlign: "center" }}>
              {labels.denied}
            </Text>
            {permission?.canAskAgain !== false ? <Button label={labels.grant} onPress={() => void requestPermission()} /> : null}
            <Button label={labels.cancel} variant="secondary" onPress={onCancel} />
          </>
        )}
      </View>
    </Modal>
  );
}
