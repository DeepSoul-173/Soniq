import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function OthersSettingsScreen() {
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
        <Text style={[styles.title, { color: theme.text }]}>Others</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
      >
        {/* ── Local files ── */}
        <SectionHeader title="Local Files" theme={theme} />

        <View style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Text style={[rowStyles.rowTitle, { color: theme.text }]}>Minimum Audio Length</Text>
          <Text style={[rowStyles.rowDesc, { color: theme.secondaryText }]}>
            Skip local files shorter than this many seconds.
          </Text>
          <View style={styles.numberRow}>
            <TouchableOpacity
              style={[styles.stepper, { backgroundColor: theme.elevated }]}
              onPress={() => updateSetting('minimumLocalAudioLength', Math.max(0, settings.minimumLocalAudioLength - 10))}
            >
              <Ionicons name="remove" size={18} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: theme.text }]}>
              {settings.minimumLocalAudioLength}s
            </Text>
            <TouchableOpacity
              style={[styles.stepper, { backgroundColor: theme.elevated }]}
              onPress={() => updateSetting('minimumLocalAudioLength', Math.min(300, settings.minimumLocalAudioLength + 10))}
            >
              <Ionicons name="add" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Text style={[rowStyles.rowTitle, { color: theme.text, marginBottom: 8 }]}>Include Folders</Text>
          <TextInput
            value={settings.includeFolders.join(', ')}
            onChangeText={(text) =>
              updateSetting('includeFolders', text.split(',').map((s) => s.trim()).filter(Boolean))
            }
            placeholder="e.g. /Music, /Downloads"
            placeholderTextColor={theme.faintText}
            style={[styles.folderInput, { color: theme.text, backgroundColor: theme.elevated }]}
            multiline
          />
        </View>

        <View style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Text style={[rowStyles.rowTitle, { color: theme.text, marginBottom: 8 }]}>Exclude Folders</Text>
          <TextInput
            value={settings.excludeFolders.join(', ')}
            onChangeText={(text) =>
              updateSetting('excludeFolders', text.split(',').map((s) => s.trim()).filter(Boolean))
            }
            placeholder="e.g. /WhatsApp/Media, /Recordings"
            placeholderTextColor={theme.faintText}
            style={[styles.folderInput, { color: theme.text, backgroundColor: theme.elevated }]}
            multiline
          />
        </View>

        {/* ── Search & discovery ── */}
        <SectionHeader title="Search & Discovery" theme={theme} />

        <ToggleRow
          title="Live Search"
          description="Trigger search results as you type without pressing Enter."
          value={settings.liveSearch}
          onChange={(v) => updateSetting('liveSearch', v)}
          theme={theme}
        />
        <ToggleRow
          title="Stream Downloaded Songs First"
          description="Play the local file before attempting to fetch a stream."
          value={settings.streamDownloadedSongsFirst}
          onChange={(v) => updateSetting('streamDownloadedSongsFirst', v)}
          theme={theme}
        />
        <ToggleRow
          title="Search Lyrics of Local Songs"
          description="Look up lyrics for local files via title and artist."
          value={settings.searchLocalLyrics}
          onChange={(v) => updateSetting('searchLocalLyrics', v)}
          theme={theme}
        />

        {/* ── Audio & system ── */}
        <SectionHeader title="Audio & System" theme={theme} />

        <ToggleRow
          title="Stop Music on App Close"
          description="Pause playback when the app is fully closed (not just minimised)."
          value={settings.stopMusicOnAppClose}
          onChange={(v) => updateSetting('stopMusicOnAppClose', v)}
          theme={theme}
        />

        {/* ── Proxy ── */}
        <SectionHeader title="Proxy" theme={theme} />

        <ToggleRow
          title="Use Proxy"
          description="Route Piped stream requests through alternate proxy instances."
          value={settings.useProxy}
          onChange={(v) => updateSetting('useProxy', v)}
          theme={theme}
        />

        {settings.useProxy && (
          <View style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={[rowStyles.rowTitle, { color: theme.text, marginBottom: 8 }]}>Proxy URL</Text>
            <Text style={[rowStyles.rowDesc, { color: theme.secondaryText, marginBottom: 10 }]}>
              Optional custom Piped instance URL (e.g. https://pipedapi.example.com).
            </Text>
            <TextInput
              value={settings.proxyUrl}
              onChangeText={(text) => updateSetting('proxyUrl', text)}
              placeholder="https://pipedapi.example.com"
              placeholderTextColor={theme.faintText}
              autoCapitalize="none"
              keyboardType="url"
              style={[styles.folderInput, { color: theme.text, backgroundColor: theme.elevated }]}
            />
          </View>
        )}

        {/* ── Privacy ── */}
        <SectionHeader title="Privacy" theme={theme} />

        <ToggleRow
          title="Save Search History"
          description="Store recent searches locally."
          value={settings.saveSearchHistory}
          onChange={(v) => updateSetting('saveSearchHistory', v)}
          theme={theme}
        />
        <ToggleRow
          title="Show Recently Played"
          description="Display your listening history on the home screen."
          value={settings.showRecentlyPlayed}
          onChange={(v) => updateSetting('showRecentlyPlayed', v)}
          theme={theme}
        />
        <ToggleRow
          title="Private Session"
          description="Pause history and recommendation updates temporarily."
          value={settings.privateSession}
          onChange={(v) => updateSetting('privateSession', v)}
          theme={theme}
        />
        <ToggleRow
          title="Local-Only Mode"
          description="Disable all network requests; only play local and downloaded files."
          value={settings.localOnlyMode}
          onChange={(v) => updateSetting('localOnlyMode', v)}
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
  numberRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12 },
  stepper: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepperValue: { fontSize: 16, fontWeight: '900', marginHorizontal: 16 },
  folderInput: {
    borderRadius: 8,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
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
