import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

// ─── Shared row components ──────────────────────────────────────────────────

function SectionHeader({ title, theme }: { title: string; theme: ReturnType<typeof getTheme> }) {
  return (
    <Text style={[rowStyles.sectionHeader, { color: theme.accent }]}>{title.toUpperCase()}</Text>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  theme,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <View style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={rowStyles.rowText}>
        <Text style={[rowStyles.rowTitle, { color: theme.text }]}>{title}</Text>
        {description ? (
          <Text style={[rowStyles.rowDesc, { color: theme.secondaryText }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.muted, true: theme.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

type PickerOption = { label: string; value: string };

function PickerRow({
  title,
  description,
  value,
  options,
  onChange,
  theme,
}: {
  title: string;
  description?: string;
  value: string;
  options: PickerOption[];
  onChange: (v: string) => void;
  theme: ReturnType<typeof getTheme>;
}) {
  const [open, setOpen] = useState(false);
  const display = options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      <TouchableOpacity
        style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => setOpen(true)}
      >
        <View style={rowStyles.rowText}>
          <Text style={[rowStyles.rowTitle, { color: theme.text }]}>{title}</Text>
          {description ? (
            <Text style={[rowStyles.rowDesc, { color: theme.secondaryText }]}>{description}</Text>
          ) : null}
        </View>
        <View style={rowStyles.valueWrap}>
          <Text style={[rowStyles.valueText, { color: theme.accent }]}>{display}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
        </View>
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={rowStyles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[rowStyles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[rowStyles.sheetTitle, { color: theme.text }]}>{title}</Text>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  rowStyles.sheetOption,
                  { borderColor: theme.border },
                  opt.value === value && { backgroundColor: theme.elevated },
                ]}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text style={[rowStyles.sheetOptionText, { color: theme.text }]}>{opt.label}</Text>
                {opt.value === value && (
                  <Ionicons name="checkmark" size={18} color={theme.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Options ────────────────────────────────────────────────────────────────

const DOWNLOAD_QUALITY_OPTIONS: PickerOption[] = [
  { label: 'Normal (~128 kbps)', value: 'normal' },
  { label: 'High (~192 kbps)', value: 'high' },
  { label: 'Very High (~320 kbps)', value: 'very_high' },
];

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function AudioQualitySettingsScreen() {
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Audio Quality</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
      >
        {/* Streaming quality tiers were removed — YouTube serves a single adaptive
            audio stream, so per-network bitrate tiers had no real effect. */}

        {/* ── Downloads ── */}
        <SectionHeader title="Downloads" theme={theme} />

        <PickerRow
          title="Download Quality"
          description="Quality used when saving a track for offline playback."
          value={settings.downloadQuality}
          options={DOWNLOAD_QUALITY_OPTIONS}
          onChange={(v) =>
            updateSetting('downloadQuality', v as typeof settings.downloadQuality)
          }
          theme={theme}
        />
        <ToggleRow
          title="Download on Cellular"
          description="Allow downloads when not on Wi-Fi (uses mobile data)."
          value={settings.downloadOnCellular}
          onChange={(v) => updateSetting('downloadOnCellular', v)}
          theme={theme}
        />

        {/* ── Data saving ── */}
        <SectionHeader title="Data Saving" theme={theme} />

        <ToggleRow
          title="Data Saver"
          description="Force low quality streaming to reduce data usage."
          value={settings.dataSaver}
          onChange={(v) => updateSetting('dataSaver', v)}
          theme={theme}
        />
        <ToggleRow
          title="Stream on Cellular"
          description="Allow streaming when Wi-Fi is unavailable."
          value={settings.streamOnCellular}
          onChange={(v) => updateSetting('streamOnCellular', v)}
          theme={theme}
        />
        <ToggleRow
          title="Offline Mode"
          description="Only play downloaded tracks; disable all network requests."
          value={settings.offlineMode}
          onChange={(v) => updateSetting('offlineMode', v)}
          theme={theme}
        />
        <ToggleRow
          title="Auto-Clean Cache"
          description="Remove old cached sources automatically when storage is low."
          value={settings.autoCleanCache}
          onChange={(v) => updateSetting('autoCleanCache', v)}
          theme={theme}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  backButton: { marginRight: 10 },
  title: { fontSize: 20, fontWeight: '900' },
  content: { paddingHorizontal: 16, paddingTop: 8 },
});

const rowStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 22,
    paddingHorizontal: 2,
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowDesc: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  valueWrap: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  valueText: { fontSize: 13, fontWeight: '800' },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    marginHorizontal: 16,
    overflow: 'hidden',
    width: '92%',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetOption: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  sheetOptionText: { fontSize: 15, fontWeight: '600' },
});
