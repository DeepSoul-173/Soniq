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

const LANGUAGE_OPTIONS: PickerOption[] = [
  { label: 'Auto (detect)', value: 'Auto' },
  { label: 'English', value: 'English' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
  { label: 'Portuguese', value: 'Portuguese' },
  { label: 'Korean', value: 'Korean' },
  { label: 'Japanese', value: 'Japanese' },
];

const REGION_OPTIONS: PickerOption[] = [
  { label: 'India', value: 'India' },
  { label: 'United States', value: 'US' },
  { label: 'United Kingdom', value: 'UK' },
  { label: 'Brazil', value: 'Brazil' },
  { label: 'South Korea', value: 'South Korea' },
  { label: 'Japan', value: 'Japan' },
  { label: 'Global', value: 'Global' },
];

const QUALITY_OPTIONS: PickerOption[] = [
  { label: 'Low (~64 kbps)', value: 'low' },
  { label: 'Normal (~128 kbps)', value: 'normal' },
  { label: 'High (~192 kbps)', value: 'high' },
  { label: 'Very High (~320 kbps)', value: 'very_high' },
];

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function PlaybackSettingsScreen() {
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
        <Text style={[styles.title, { color: theme.text }]}>Music & Playback</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
      >
        {/* ── Location & language ── */}
        <SectionHeader title="Language & Region" theme={theme} />

        <PickerRow
          title="Music Language"
          description="Filter and prioritize tracks in this language."
          value={settings.musicLanguage}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => updateSetting('musicLanguage', v)}
          theme={theme}
        />
        <PickerRow
          title="Local Charts Location"
          description="Region used for trending and chart recommendations."
          value={settings.localChartsLocation}
          options={REGION_OPTIONS}
          onChange={(v) => updateSetting('localChartsLocation', v)}
          theme={theme}
        />

        {/* ── Streaming quality ── */}
        <SectionHeader title="Streaming Quality" theme={theme} />

        <PickerRow
          title="Streaming Quality"
          description="Default quality when network type is unknown."
          value={settings.cellularStreamingQuality}
          options={QUALITY_OPTIONS}
          onChange={(v) =>
            updateSetting('cellularStreamingQuality', v as typeof settings.cellularStreamingQuality)
          }
          theme={theme}
        />
        <PickerRow
          title="Streaming Quality on Wi-Fi"
          description="Higher quality is safe on Wi-Fi."
          value={settings.wifiStreamingQuality}
          options={QUALITY_OPTIONS}
          onChange={(v) =>
            updateSetting('wifiStreamingQuality', v as typeof settings.wifiStreamingQuality)
          }
          theme={theme}
        />
        <PickerRow
          title="YouTube / Proxy Quality"
          description="Bitrate cap for Piped and proxy streams."
          value={settings.proxyStreamingQuality}
          options={QUALITY_OPTIONS}
          onChange={(v) =>
            updateSetting('proxyStreamingQuality', v as typeof settings.proxyStreamingQuality)
          }
          theme={theme}
        />

        {/* ── Session & queue ── */}
        <SectionHeader title="Session & Queue" theme={theme} />

        <ToggleRow
          title="Load Last Session on Start"
          description="Resume your queue and position when you reopen the app."
          value={settings.loadLastSessionOnStart}
          onChange={(v) => updateSetting('loadLastSessionOnStart', v)}
          theme={theme}
        />
        <ToggleRow
          title="Replay on Skip Previous"
          description="Tap previous within 3 s to restart the current track."
          value={settings.replayOnSkipPrevious}
          onChange={(v) => updateSetting('replayOnSkipPrevious', v)}
          theme={theme}
        />
        <ToggleRow
          title="Enforce Repeating"
          description="Keep repeat active even when you clear and rebuild the queue."
          value={settings.enforceRepeating}
          onChange={(v) => updateSetting('enforceRepeating', v)}
          theme={theme}
        />
        <ToggleRow
          title="Autoplay"
          description="Extend the queue with recommendations when it runs out."
          value={settings.autoplay}
          onChange={(v) => updateSetting('autoplay', v)}
          theme={theme}
        />

        {/* ── Caching & background ── */}
        <SectionHeader title="Caching & Background" theme={theme} />

        <ToggleRow
          title="Cache Songs"
          description="Store resolved stream sources locally to speed up repeat plays."
          value={settings.cacheSongs}
          onChange={(v) => updateSetting('cacheSongs', v)}
          theme={theme}
        />
        <ToggleRow
          title="Play in Background"
          description="Continue audio when the screen is off or another app is open."
          value={settings.playInBackground}
          onChange={(v) => updateSetting('playInBackground', v)}
          theme={theme}
        />
        <ToggleRow
          title="Gapless Playback"
          description="Remove silence between tracks when supported."
          value={settings.gaplessPlayback}
          onChange={(v) => updateSetting('gaplessPlayback', v)}
          theme={theme}
        />
        <ToggleRow
          title="Normalize Volume"
          description="Level loudness across tracks."
          value={settings.normalizeVolume}
          onChange={(v) => updateSetting('normalizeVolume', v)}
          theme={theme}
        />
        <ToggleRow
          title="Allow Explicit Content"
          description="Show tracks tagged with explicit lyrics."
          value={settings.allowExplicitContent}
          onChange={(v) => updateSetting('allowExplicitContent', v)}
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
