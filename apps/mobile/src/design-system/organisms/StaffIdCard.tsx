import { View } from "react-native";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { Touchable } from "../atoms/Touchable";
import { Avatar } from "../molecules/Avatar";
import { BrandMark } from "../molecules/BrandMark";
import { useTheme } from "../use-theme";

export type StaffIdCardProps = {
  brandLabel: string;
  name: string;
  roleLabel: string;
  codeLabel: string;
  code: string;
  photoUrl: string | null;
  /** Acción de la X en la esquina de la tarjeta. */
  onClose?: () => void;
  closeLabel?: string;
  /** Si se pasa, tocar la foto la cambia: la foto lleva una insignia de cámara. */
  onPhotoPress?: () => void;
  photoLabel?: string;
};

/** Credencial del staff: marca, foto, nombre, rol y código. Todo lo que identifica va en texto. */
export function StaffIdCard({ brandLabel, name, roleLabel, codeLabel, code, photoUrl, onClose, closeLabel, onPhotoPress, photoLabel }: StaffIdCardProps) {
  const theme = useTheme();
  const t = theme.components.credential;

  return (
    <View
      style={{
        alignSelf: "center",
        width: "100%",
        maxWidth: t.maxWidth,
        borderRadius: t.radius,
        borderWidth: t.borderWidth,
        borderColor: t.border,
        backgroundColor: t.bg,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: t.bandGap,
          height: t.bandHeight,
          paddingHorizontal: t.bandPaddingH,
          paddingTop: t.bandGap,
          backgroundColor: t.bandBg,
        }}
      >
        <BrandMark variant="isotipo" size={t.markSize} animated={false} />
        <Text variant="title" color={t.bandFg} style={{ marginTop: t.bandGap / 2 }}>
          {brandLabel}
        </Text>
      </View>

      {onClose ? (
        <Touchable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={{ position: "absolute", top: t.closeInset, right: t.closeInset, alignItems: "center", justifyContent: "center", zIndex: 1 }}
        >
          <Icon name="close" color={t.bandFg} size={theme.type.title.fontSize} />
        </Touchable>
      ) : null}

      <View
        accessible
        accessibilityLabel={`${brandLabel}. ${name}. ${roleLabel}. ${codeLabel} ${code}`}
        style={{
          alignItems: "center",
          gap: t.bodyGap,
          paddingHorizontal: t.bodyPaddingH,
          paddingBottom: t.bodyPaddingBottom,
          // La foto cruza la banda: sube `avatarOverlap` sobre ella.
          marginTop: -t.avatarOverlap,
        }}
      >
        {onPhotoPress ? (
          <Touchable onPress={onPhotoPress} accessibilityRole="button" accessibilityLabel={photoLabel} style={{ borderRadius: theme.components.avatar.sizes.card / 2 }}>
            <Avatar name={name} photoUrl={photoUrl} size="card" />
            <View
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: t.badgeSize,
                height: t.badgeSize,
                borderRadius: t.badgeSize / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.badgeBg,
                borderWidth: 3,
                borderColor: t.badgeBorder,
              }}
            >
              <Icon name="camera" color={t.badgeFg} size={Math.round(t.badgeSize / 2)} />
            </View>
          </Touchable>
        ) : (
          <Avatar name={name} photoUrl={photoUrl} size="card" />
        )}
        <Text variant="title" style={{ textAlign: "center" }}>
          {name}
        </Text>
        <Text variant="bodyStrong" style={{ textAlign: "center" }}>
          {roleLabel}
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: t.codeBorder,
            borderRadius: t.codeRadius,
            paddingHorizontal: t.codePaddingH,
            paddingVertical: t.codePaddingV,
          }}
        >
          <Text variant="label" color={theme.colors.textQuiet}>
            {codeLabel} · {code}
          </Text>
        </View>
      </View>
    </View>
  );
}
