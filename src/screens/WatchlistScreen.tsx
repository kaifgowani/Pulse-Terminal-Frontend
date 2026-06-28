import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, RefreshControl, Modal, TextInput, Dimensions, PanResponder, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { formatCurrency } from '../utils/formatCurrency';
import { CommandChart } from '../components/CommandChart';
import { fetchApi } from '../utils/apiClient';

const API_URL = Platform.OS === 'web' ? 'https://pulse-terminal-backend.onrender.com/api' : 'https://pulse-terminal-backend.onrender.com/api';
const { width } = Dimensions.get('window');

export default function WatchlistScreen() {
  const navigation = useNavigation<any>();
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [activeWlId, setActiveWlId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newWlName, setNewWlName] = useState('');

  const [activeAsset, setActiveAsset] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [technicalData, setTechnicalData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const fetchWatchlists = async () => {
    setLoading(true);
    try {
      const res = await fetchApi(`/watchlists`);
      const data = await res.json();
      setWatchlists(data);
      if (data.length > 0 && !activeWlId) {
        setActiveWlId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchWatchlists();
    }, [])
  );

  const activeWl = watchlists.find(w => w.id === activeWlId);

  useEffect(() => {
    if (activeWl && activeWl.items.length > 0) {
      if (activeAsset) {
        const match = activeWl.items.find((a: any) => a.symbol === activeAsset.symbol);
        if (match) setActiveAsset(match);
      } else {
        setActiveAsset(activeWl.items[0]);
      }
    } else {
      setActiveAsset(null);
    }
  }, [activeWl]);

  useEffect(() => {
    if (!activeAsset) return;
    setChartLoading(true);
    setScrubIndex(null);

    Promise.all([
      fetchApi(`/assets/real/${encodeURIComponent(activeAsset.symbol)}/history?range=1mo&interval=1d`).then(r => r.json()),
      fetchApi(`/technical/${encodeURIComponent(activeAsset.symbol)}`).then(r => r.json()).catch(() => null)
    ])
      .then(([histData, techData]) => {
        if (histData.quotes) {
          setHistory(histData.quotes.filter((q: any) => q.close !== null));
        }
        if (techData) {
          setTechnicalData(techData);
        }
        setChartLoading(false);
      })
      .catch(err => {
        console.error(err);
        setChartLoading(false);
      });
  }, [activeAsset?.symbol]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => handleScrub(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => handleScrub(evt.nativeEvent.locationX),
      onPanResponderRelease: () => setScrubIndex(null),
      onPanResponderTerminate: () => setScrubIndex(null),
    })
  ).current;

  const handleScrub = (x: number) => {
    if (history.length === 0) return;
    const drawingWidth = width - 60;
    const stepX = drawingWidth / (history.length - 1 || 1);
    let index = Math.round(x / stepX);
    if (index < 0) index = 0;
    if (index >= history.length) index = history.length - 1;
    setScrubIndex(index);
  };

  const handleCreateWatchlist = async () => {
    if (!newWlName.trim()) return;
    try {
      await fetchApi(`/watchlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWlName.trim() })
      });
      setNewWlName('');
      setModalVisible(false);
      fetchWatchlists();
    } catch (err) {
      console.error(err);
    }
  };

  const renderItem = (item: any) => {
    const price = item.currentPrice || 0;
    const changeAbs = item.changeAbs || 0;
    const changePct = item.changePct || 0;
    const isPositive = changePct >= 0;
    const color = isPositive ? theme.colors.success : theme.colors.danger;
    const sign = isPositive ? '+' : '';
    const isActive = activeAsset?.symbol === item.symbol;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.assetRow, isActive && styles.assetRowActive]}
        onPress={() => setActiveAsset(item)}
      >
        <View style={styles.colSymbol}>
          <Text style={[styles.assetName, isActive && { color: theme.colors.primary }]} numberOfLines={1}>{item.name || item.symbol}</Text>
        </View>

        <View style={styles.colPrice}>
          <Text style={styles.priceText}>{formatCurrency(price, item.currency)}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.changeText, { color }]}>
              {sign}{changePct.toFixed(2)}%
            </Text>
          </View>
        </View>
        <View style={{ marginLeft: 10, justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={20} color="#444" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WATCHLISTS</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {watchlists.map(wl => (
            <TouchableOpacity
              key={wl.id}
              style={[styles.tabBtn, activeWlId === wl.id && styles.tabBtnActive]}
              onPress={() => setActiveWlId(wl.id)}
            >
              <Text style={[styles.tabText, activeWlId === wl.id && styles.tabTextActive]}>{wl.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Top Half: Charting */}
      <View style={styles.topHalf}>
        {activeAsset && (
          <View style={styles.chartHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View>
                <Text style={styles.chartName}>{activeAsset.name || activeAsset.shortname || activeAsset.symbol}</Text>
              </View>
              <TouchableOpacity
                style={{ marginLeft: 10, padding: 4 }}
                onPress={() => navigation.navigate('AssetDetail', {
                  symbol: activeAsset.symbol,
                  name: activeAsset.name || activeAsset.shortname,
                  price: activeAsset.currentPrice || activeAsset.regularMarketPrice,
                  change: activeAsset.changeAbs || activeAsset.regularMarketChange || 0,
                  pct: activeAsset.changePct ?? (activeAsset.regularMarketChangePercent || 0),
                  currency: activeAsset.currency
                })}
              >
                <Ionicons name="expand" size={16} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.chartPrice}>
                {scrubIndex !== null && history[scrubIndex]
                  ? formatCurrency(history[scrubIndex].close, activeAsset.currency)
                  : formatCurrency(activeAsset.currentPrice || activeAsset.regularMarketPrice, activeAsset.currency)}
              </Text>
              {scrubIndex !== null && history[scrubIndex] && (
                <Text style={styles.chartDate}>
                  {new Date(history[scrubIndex].date).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={{ flex: 1, justifyContent: 'center' }} {...panResponder.panHandlers}>
          {chartLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : (
            <CommandChart
              history={history}
              technicalData={technicalData}
              color={activeAsset && ((activeAsset.changePct ?? activeAsset.regularMarketChangePercent) >= 0) ? theme.colors.success : theme.colors.danger}
              scrubIndex={scrubIndex}
            />
          )}
        </View>
      </View>

      <View style={styles.bottomHalf}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchWatchlists} tintColor={theme.colors.primary} />}
        >
          {activeWl && activeWl.items.length === 0 ? (
            <Text style={styles.emptyText}>No assets in this watchlist.</Text>
          ) : (
            activeWl?.items.map(renderItem)
          )}
        </ScrollView>
      </View>

      {/* Create Watchlist Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Watchlist</Text>
            <TextInput
              style={styles.input}
              placeholder="Watchlist Name"
              placeholderTextColor={theme.colors.textSecondary}
              value={newWlName}
              onChangeText={setNewWlName}
              autoFocus
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateWatchlist}>
              <Text style={styles.submitBtnText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#333', marginTop: 10 }]} onPress={() => setModalVisible(false)}>
              <Text style={styles.submitBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  assetRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  assetRowActive: {
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  colSymbol: {
    flex: 2,
    justifyContent: 'center',
  },
  colPrice: {
    flex: 1.5,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  assetSymbol: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  assetName: {
    color: '#eee',
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  topHalf: {
    flex: 0.55,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  bottomHalf: {
    flex: 0.45,
    backgroundColor: '#0a0a0a',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
  },
  chartSymbol: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chartName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chartPrice: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  chartDate: {
    color: '#aaa',
    fontSize: 12,
  },
});
