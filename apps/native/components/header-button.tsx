import "@/unistyles";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { ComponentRef, Ref } from "react";
import { Pressable } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function HeaderButton({
  onPress,
  ref,
}: {
  onPress?: () => void;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}) {
  return (
    <Pressable onPress={onPress} ref={ref} style={styles.button}>
      {({ pressed }) => (
        <FontAwesome
          color={styles.icon.color}
          name="info-circle"
          size={20}
          style={{
            opacity: pressed ? 0.7 : 1,
          }}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: `${theme.colors.secondary}80`, // 50% opacity
  },
  icon: {
    color: theme.colors.secondaryForeground,
  },
}));
