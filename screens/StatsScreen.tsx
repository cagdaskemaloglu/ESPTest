/**
 * screens/StatsScreen.tsx
 *
 * Cihaz kullanım istatistikleri — günlük/haftalık görünüm.
 * Bar chart manuel olarak SVG/View ile çizilir (harici kütüphane gerekmez).
 * Cihaz bazında veya tüm cihazlar birleşik olarak görülebilir.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLanguage } from '../i18n/LanguageContext';
import {
  clearAllStats,
  DailyStat,
  getCombinedStats,
  getDailyStats,
} from '../services/usageStorage';
import { Colors, Fonts, Radius, Spacing } from '../theme/colors';
import { Device } from '../types/Device';

type Props = {
  devices:      Device[];
  onBack:       () => void;
};

type ViewMode = 'daily' | 'weekly';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H  = 140;
const DAYS     = 7;

// Tarihi kısa gün adına çevir — Mon, Tue... / Pzt, Sal...
function shortDay(dateStr: string, lang: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short' });
}

export default function StatsScreen({ devices, onBack }: Props) {
  const { t, language } = useLanguage();

  const [mode,        setMode]        = useState<ViewMode>('weekly');
  const [stats,       setStats]       = useState<DailyStat[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [loading,     setLoading]     = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const days = mode === 'weekly' ? 7 : 1;
      let data: DailyStat[];

      if (selectedDevice === 'all') {
        data = await getCombinedStats(devices.map((d) => d.id), days);
      } else {
        data = await getDailyStats(selectedDevice, days);
      }
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedDevice, devices]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleClearAll = () => {
    Alert.alert(
      t('stats.clearTitle'),
      t('stats.clearDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text:  t('stats.clearButton'),
          style: 'destructive',
          onPress: async () => {
            await clearAllStats(devices.map((d) => d.id));
            await loadStats();
          },
        },
      ]
    );
  };

  // ── Özet hesapla ─────────────────────────────────────────────────────────
  const totalHours   = stats.reduce((sum, s) => sum + s.hoursOn, 0);
  const totalToggles = stats.reduce((sum, s) => sum + s.toggleCount, 0);
  const hasData      = totalToggles > 0 || totalHours > 0;

  // ── Bar chart ─────────────────────────────────────────────────────────────
  const maxHours = Math.max(...stats.map((s) => s.hoursOn), 0.1);
  const barW     = stats.length > 0
    ? (SCREEN_W - Spacing.xl * 2 - (stats.length - 1) * Spacing.sm) / stats.length
    : 40;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← {t('common.back').toUpperCase()}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>STATİSTİK</Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn} activeOpacity={0.7}>
          <Text style={styles.clearBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Görünüm modu */}
        <View style={styles.modeRow}>
          {(['daily', 'weekly'] as ViewMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}
              activeOpacity={0.75}
            >
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'daily' ? t('stats.daily') : t('stats.weekly')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cihaz filtresi */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deviceFilter}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedDevice === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedDevice('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, selectedDevice === 'all' && styles.filterChipTextActive]}>
              Tümü
            </Text>
          </TouchableOpacity>
          {devices.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.filterChip, selectedDevice === d.id && styles.filterChipActive]}
              onPress={() => setSelectedDevice(d.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, selectedDevice === d.id && styles.filterChipTextActive]}>
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyDesc}>{t('common.loading')}</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>{t('stats.noData')}</Text>
            <Text style={styles.emptyDesc}>{t('stats.noDataDesc')}</Text>
          </View>
        ) : (
          <>
            {/* Özet kartları */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {totalHours.toFixed(1)}
                </Text>
                <Text style={styles.summaryLabel}>{t('stats.hoursOn')}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalToggles}</Text>
                <Text style={styles.summaryLabel}>{t('stats.timesToggled')}</Text>
              </View>
            </View>

            {/* Bar chart — açık kalma süresi */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>{t('stats.hoursOn').toUpperCase()}</Text>
              <View style={styles.chart}>
                {stats.map((stat, i) => {
                  const heightPct = maxHours > 0 ? stat.hoursOn / maxHours : 0;
                  const barHeight = Math.max(heightPct * CHART_H, stat.hoursOn > 0 ? 4 : 0);
                  const isToday   = i === stats.length - 1;

                  return (
                    <View key={stat.date} style={[styles.barWrapper, { width: barW }]}>
                      <Text style={styles.barValue}>
                        {stat.hoursOn > 0 ? stat.hoursOn.toFixed(1) : ''}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[
                          styles.bar,
                          { height: barHeight },
                          isToday && { backgroundColor: Colors.cyan },
                        ]} />
                      </View>
                      <Text style={[styles.barLabel, isToday && { color: Colors.cyan }]}>
                        {shortDay(stat.date, language)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Toggle sayısı chart */}
            {mode === 'weekly' && (
              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>{t('stats.timesToggled').toUpperCase()}</Text>
                <View style={styles.chart}>
                  {(() => {
                    const maxT = Math.max(...stats.map((s) => s.toggleCount), 1);
                    return stats.map((stat, i) => {
                      const h = Math.max((stat.toggleCount / maxT) * CHART_H, stat.toggleCount > 0 ? 4 : 0);
                      const isToday = i === stats.length - 1;
                      return (
                        <View key={stat.date} style={[styles.barWrapper, { width: barW }]}>
                          <Text style={styles.barValue}>
                            {stat.toggleCount > 0 ? stat.toggleCount : ''}
                          </Text>
                          <View style={styles.barTrack}>
                            <View style={[
                              styles.bar,
                              { height: h, backgroundColor: Colors.purple },
                              isToday && { backgroundColor: Colors.cyan },
                            ]} />
                          </View>
                          <Text style={[styles.barLabel, isToday && { color: Colors.cyan }]}>
                            {shortDay(stat.date, language)}
                          </Text>
                        </View>
                      );
                    });
                  })()}
                </View>
              </View>
            )}

            {/* Günlük detay tablosu */}
            <View style={styles.tableContainer}>
              <Text style={styles.chartTitle}>DETAY</Text>
              {[...stats].reverse().map((stat) => (
                <View key={stat.date} style={styles.tableRow}>
                  <Text style={styles.tableDate}>
                    {new Date(stat.date + 'T12:00:00').toLocaleDateString(
                      language === 'tr' ? 'tr-TR' : 'en-US',
                      { day: 'numeric', month: 'short' }
                    )}
                  </Text>
                  <Text style={styles.tableValue}>{stat.hoursOn.toFixed(1)} sa</Text>
                  <Text style={styles.tableValue}>{stat.toggleCount} kez</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { width: 60 },
  backText: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text2 },
  headerTitle: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.text3 },
  clearBtn: { width: 60, alignItems: 'flex-end' },
  clearBtnText: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text3 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  modeRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
  },
  modeBtn: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  modeBtnActive:     { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  modeBtnText:       { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: Colors.text3 },
  modeBtnTextActive: { color: Colors.cyan },

  deviceFilter: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full ?? 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  filterChipActive:     { borderColor: Colors.cyan2, backgroundColor: Colors.cyanAlpha },
  filterChipText:       { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text3 },
  filterChipTextActive: { color: Colors.cyan },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl * 2, gap: Spacing.md },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyDesc:  { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text2, textAlign: 'center', lineHeight: 20 },

  summaryRow: {
    flexDirection: 'row', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
  },
  summaryCard: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.bg2, padding: Spacing.lg, alignItems: 'center',
  },
  summaryValue: { fontFamily: Fonts.sans, fontSize: 28, fontWeight: '700', color: Colors.cyan },
  summaryLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.text3, marginTop: Spacing.xs },

  chartContainer: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl,
  },
  chartTitle: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 2, color: Colors.text3, marginBottom: Spacing.md },
  chart: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: Spacing.sm, height: CHART_H + 40,
  },
  barWrapper: { alignItems: 'center', gap: 4 },
  barValue:  { fontFamily: Fonts.mono, fontSize: 8, color: Colors.text3, height: 14 },
  barTrack:  { width: '100%', height: CHART_H, justifyContent: 'flex-end' },
  bar: {
    width: '100%', borderRadius: Radius.sm,
    backgroundColor: Colors.border2,
  },
  barLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 0.5, color: Colors.text3 },

  tableContainer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tableDate:  { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text2, flex: 1 },
  tableValue: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text3 },
});