import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, Platform, PanResponder, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { fetchAssets } from '../store/slices/assetsSlice';
import { RootState, AppDispatch } from '../store/store';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { formatCurrency } from '../utils/formatCurrency';
import { TickerRibbon } from '../components/TickerRibbon';
import { CommandChart } from '../components/CommandChart';
import { fetchApi } from '../utils/apiClient';

const API_URL = Platform.OS === 'web' ? 'https://pulse-terminal-backend.onrender.com/api' : 'https://pulse-terminal-backend.onrender.com/api';
const { width } = Dimensions.get('window');

export default function CommandCenterScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  
  const [activeAsset, setActiveAsset] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [technicalData, setTechnicalData] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const [activeCategory, setActiveCategory] = useState('Indices');
  const { categoryAssets, status } = useSelector((state: RootState) => state.assets);
  const assets = categoryAssets[activeCategory] || [];
  const CATEGORIES = ['Indices', 'Stocks', 'ETFs', 'Bonds', 'Crypto', 'Currencies', 'Commodities'];

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setIsSearching(true);
      fetchApi(`/assets/search/${encodeURIComponent(searchQuery.trim())}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data);
          setIsSearching(false);
        })
        .catch(err => {
          console.error(err);
          setIsSearching(false);
        });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    dispatch(fetchAssets({ category: activeCategory, include: activeAsset?.symbol }));
    const interval = setInterval(() => dispatch(fetchAssets({ category: activeCategory, include: activeAsset?.symbol })), 10000);
    return () => clearInterval(interval);
  }, [dispatch, activeCategory]);

  useEffect(() => {
    if (activeAsset) {
      const match = assets.find(a => a.symbol === activeAsset.symbol);
      if (match) setActiveAsset(match);
    } else if (assets.length > 0) {
      setActiveAsset(assets[0]);
    }
  }, [assets]);

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

  useEffect(() => {
    if (activeAsset && history.length > 0) {
      const latestPrice = activeAsset.currentPrice || activeAsset.regularMarketPrice || activeAsset.price;
      if (latestPrice) {
        setHistory(prev => {
          if (prev.length === 0) return prev;
          const newHist = [...prev];
          const lastIdx = newHist.length - 1;
          if (newHist[lastIdx].close !== latestPrice) {
            newHist[lastIdx] = { ...newHist[lastIdx], close: latestPrice };
            return newHist;
          }
          return prev;
        });
      }
    }
  }, [activeAsset?.currentPrice, activeAsset?.regularMarketPrice, activeAsset?.price]);

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
    const chartWidth = width;
    const stepX = chartWidth / (history.length - 1 || 1);
    let index = Math.round(x / stepX);
    if (index < 0) index = 0;
    if (index >= history.length) index = history.length - 1;
    setScrubIndex(index);
  };

  const renderAssetRow = ({ item }: { item: any }) => {
    const symbol = item.symbol;
    const name = item.name || item.shortname || item.longname || symbol;
    const price = item.currentPrice || item.regularMarketPrice || 0;
    const changePct = item.changePct !== undefined ? item.changePct : (item.regularMarketChangePercent || 0);
    const isPositive = changePct >= 0;
    const color = isPositive ? theme.colors.success : theme.colors.danger;
    const isActive = activeAsset?.symbol === symbol;

    return (
      <TouchableOpacity
        style={[styles.assetRow, isActive && styles.assetRowActive]}
        onPress={() => {
          setActiveAsset(item);
          if (searchQuery) setSearchQuery('');
        }}
      >
        <View style={styles.colSymbol}>
          <Text style={[styles.assetName, isActive && { color: theme.colors.primary }]} numberOfLines={1}>{name || symbol}</Text>
        </View>
        <View style={styles.colPrice}>
          <Text style={styles.priceText}>{formatCurrency(price, item.currency)}</Text>
          <Text style={[styles.changeText, { color }]}>
            {isPositive ? '+' : ''}{changePct.toFixed(2)}%
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TickerRibbon />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#666" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search any asset globally..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#666" />
          </TouchableOpacity>
        )}
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

      {/* Bottom Half: Dense List */}
      <View style={styles.bottomHalf}>
        {searchQuery.length > 0 ? (
          <View style={{ flex: 1 }}>
            <View style={[styles.tableHeader, { backgroundColor: '#1a1a1a' }]}>
              <Text style={styles.tableHeaderText}>SEARCH RESULTS {isSearching ? '...' : ''}</Text>
            </View>
            <FlashList
              data={searchResults}
              renderItem={renderAssetRow}
              estimatedItemSize={60}
              keyExtractor={(item) => item.symbol}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryBtn, activeCategory === cat && styles.categoryBtnActive]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>ASSET</Text>
              <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>PRICE (24H)</Text>
            </View>
            <FlashList
              data={assets}
              renderItem={renderAssetRow}
              estimatedItemSize={60}
              keyExtractor={(item) => item.symbol}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    marginHorizontal: 15,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
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
  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  categoryBtn: {
    marginRight: 15,
  },
  categoryBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  categoryText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 12,
  },
  categoryTextActive: {
    color: theme.colors.primary,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tableHeaderText: {
    color: '#666',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  assetRowActive: {
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  colSymbol: {
    flex: 1,
  },
  colPrice: {
    flex: 1,
    alignItems: 'flex-end',
  },
  assetSymbol: {
    color: '#eee',
    fontSize: 15,
    fontWeight: 'bold',
  },
  assetName: {
    color: '#eee',
    fontSize: 15,
    fontWeight: 'bold',
  },
  priceText: {
    color: '#eee',
    fontSize: 14,
    fontWeight: '600',
  },
  changeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  }
});
