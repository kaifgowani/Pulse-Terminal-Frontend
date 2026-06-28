import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Modal, Platform, Dimensions, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { formatCurrency } from '../utils/formatCurrency';
import { Canvas, Path, LinearGradient as SkiaLinearGradient, vec, Skia } from '@shopify/react-native-skia';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchApi } from '../utils/apiClient';

const API_URL = Platform.OS === 'web' ? 'https://pulse-terminal-backend.onrender.com/api' : 'https://pulse-terminal-backend.onrender.com/api';
const { width } = Dimensions.get('window');

// Indicators math
function calculateRSI(prices: number[], period = 14) {
  if (prices.length <= period) return '-';
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }
  if (avgLoss === 0) return '100';
  const rs = avgGain / avgLoss;
  return (100 - (100 / (1 + rs))).toFixed(2);
}

function calculateEMA(prices: number[], period: number) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * k + ema;
  }
  return ema;
}

function calculateMACD(prices: number[]) {
  if (prices.length < 26) return '-';
  let ema12 = prices[0];
  let ema26 = prices[0];
  const k12 = 2 / (12 + 1);
  const k26 = 2 / (26 + 1);
  for (let i = 1; i < prices.length; i++) {
    ema12 = prices[i] * k12 + ema12 * (1 - k12);
    ema26 = prices[i] * k26 + ema26 * (1 - k26);
  }
  return (ema12 - ema26).toFixed(2);
}

export const AssetDetailScreen = ({ route, navigation }: any) => {
  const { symbol, name, price, change, pct, currency, assetType } = route.params;
  const { assets } = useSelector((state: RootState) => state.assets);
  const liveAsset = assets.find((a: any) => a.symbol === symbol);
  const livePrice = liveAsset ? (liveAsset.currentPrice || liveAsset.regularMarketPrice || liveAsset.price) : parseFloat(price);

  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('1mo'); // 1d, 5d, 1mo, 3mo, 1y
  const [activeTab, setActiveTab] = useState('Chart');

  // Chart Interaction
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
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
    const chartWidth = width - 40;
    const stepX = chartWidth / (history.length - 1 || 1);
    let index = Math.round(x / stepX);
    if (index < 0) index = 0;
    if (index >= history.length) index = history.length - 1;
    setScrubIndex(index);
  };

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [wlModalVisible, setWlModalVisible] = useState(false);
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const [priceStr, setPriceStr] = useState(String(price));
  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');

  useEffect(() => {
    fetchApi(`/watchlists`).then(r => r.json()).then(data => setWatchlists(data)).catch(() => { });
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchApi(`/assets/real/${encodeURIComponent(symbol)}/history?range=${range}&interval=1d`).then(r => r.json()),
      fetchApi(`/assets/real/${encodeURIComponent(symbol)}/summary`).then(r => r.json()).catch(() => null)
    ])
      .then(([histData, sumData]) => {
        if (histData.quotes) {
          const validQuotes = histData.quotes.filter((q: any) => q.close !== null);
          setHistory(validQuotes);
        }
        if (sumData) {
          setSummary(sumData);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [symbol, range]);

  // Dynamically update the last candle when live price changes
  useEffect(() => {
    if (history.length > 0 && livePrice) {
      setHistory(prev => {
        if (prev.length === 0) return prev;
        const newHist = [...prev];
        const lastIdx = newHist.length - 1;
        if (newHist[lastIdx].close !== livePrice) {
          newHist[lastIdx] = { ...newHist[lastIdx], close: livePrice };
          return newHist;
        }
        return prev;
      });
    }
  }, [livePrice]);

  const handleAddPortfolio = () => {
    const rawQ = parseFloat(quantityStr);
    const p = parseFloat(priceStr);
    if (isNaN(rawQ) || isNaN(p) || rawQ <= 0 || p <= 0) return alert('Invalid values');

    const finalQuantity = transactionType === 'SELL' ? -rawQ : rawQ;

    fetchApi(`/portfolio/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        quantity: finalQuantity,
        avgPrice: p
      })
    })
      .then(r => r.json())
      .then(data => {
        setModalVisible(false);
        alert(`Successfully ${transactionType === 'SELL' ? 'sold' : 'bought'} ${quantityStr} shares of ${symbol}!`);
      })
      .catch(err => alert('Failed to add to portfolio: ' + err.message));
  };

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    try {
      const res = await fetchApi(`/watchlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWatchlistName.trim() }),
      });
      const data = await res.json();
      setWatchlists([...watchlists, data]);
      setNewWatchlistName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWatchlist = (watchlistId: string) => {
    fetchApi(`/watchlists/${watchlistId}/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol })
    })
      .then(() => {
        setWlModalVisible(false);
        alert(`Successfully added ${symbol} to watchlist!`);
      })
      .catch(err => alert('Failed to add to watchlist: ' + err.message));
  };

  const renderCandlestick = () => {
    if (history.length === 0) return <Text style={styles.errorText}>No chart data available</Text>;

    const chartHeight = 250;
    const chartWidth = width - 40;
    const drawingWidth = chartWidth - 50;
    let maxIdx = 0;
    let minIdx = 0;
    if (history.length > 0) {
      history.forEach((q, i) => {
        if (q.close > history[maxIdx].close) maxIdx = i;
        if (q.close < history[minIdx].close) minIdx = i;
      });
    }
    const minPrice = history[minIdx]?.close || 0;
    const maxPrice = history[maxIdx]?.close || 1;
    const priceRange = maxPrice - minPrice || 1;
    const pad = priceRange * 0.15;
    const scaledMinPrice = minPrice - pad;
    const scaledMaxPrice = maxPrice + pad;
    const priceDiff = scaledMaxPrice - scaledMinPrice;

    const getY = (p: number) => chartHeight - ((p - scaledMinPrice) / priceDiff) * chartHeight;
    const stepX = drawingWidth / (history.length - 1 || 1);

    const path = Skia.Path.Make();
    const gradientPath = Skia.Path.Make();

    history.forEach((quote, i) => {
      const x = i * stepX;
      const y = getY(quote.close);
      if (i === 0) {
        path.moveTo(x, y);
        gradientPath.moveTo(x, y);
      } else {
        path.lineTo(x, y);
        gradientPath.lineTo(x, y);
      }
    });

    // close the gradient path
    gradientPath.lineTo(chartWidth, chartHeight);
    gradientPath.lineTo(0, chartHeight);
    gradientPath.close();

    const isUp = history[history.length - 1].close >= history[0].close;
    const cColor = isUp ? theme.colors.success : theme.colors.danger;

    return (
      <View style={{ position: 'relative' }} {...panResponder.panHandlers}>
        {scrubIndex !== null && (
          <View style={[styles.scrubIndicator, { left: scrubIndex * stepX }]}>
            <View style={[styles.scrubLine, { height: chartHeight, backgroundColor: theme.colors.textSecondary }]} />
            <View style={styles.scrubDot} />
          </View>
        )}
        <Canvas style={{ width: chartWidth, height: chartHeight }} pointerEvents="none">
          <Path path={gradientPath}>
            <SkiaLinearGradient
              start={vec(0, 0)}
              end={vec(0, chartHeight)}
              colors={[`${cColor}80`, `${cColor}00`]}
            />
          </Path>
          <Path path={path} style="stroke" strokeWidth={2} color={cColor} />
        </Canvas>
        {/* Fixed Y Axis Prices & Grid */}
        <Text style={[styles.axisText, { top: 0 }]}>{scaledMaxPrice.toFixed(2)}</Text>
        <Text style={[styles.axisText, { top: chartHeight / 2 - 7 }]}>{((scaledMaxPrice + scaledMinPrice) / 2).toFixed(2)}</Text>
        <Text style={[styles.axisText, { top: chartHeight - 15 }]}>{scaledMinPrice.toFixed(2)}</Text>
        <View style={[styles.gridLine, { top: chartHeight / 2, width: drawingWidth }]} />

        {/* High / Low Intersecting Markers */}
        {history.length > 0 && (() => {
          const highY = getY(maxPrice);
          const lowY = getY(minPrice);
          const maxDateLeft = Math.max(0, Math.min((maxIdx * stepX) - 20, drawingWidth - 40));
          const minDateLeft = Math.max(0, Math.min((minIdx * stepX) - 20, drawingWidth - 40));
          const datesOverlap = Math.abs(maxDateLeft - minDateLeft) < 45;

          const showStartX = maxIdx * stepX > 50 && minIdx * stepX > 50;
          const showEndX = maxIdx * stepX < drawingWidth - 50 && minIdx * stepX < drawingWidth - 50;
          const showMidX = Math.abs(maxIdx * stepX - drawingWidth / 2) > 40 && Math.abs(minIdx * stepX - drawingWidth / 2) > 40;

          return (
            <>
              {/* HIGH */}
              <View style={[styles.highlightLine, { left: maxIdx * stepX, height: chartHeight }]} />
              <View style={[styles.highlightLineHorizontal, { top: highY, width: drawingWidth }]} />

              <Text style={[styles.axisXText, { left: maxDateLeft, top: highY - 15, color: theme.colors.success }]}>
                {new Date(history[maxIdx].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>

              <Text style={[styles.axisText, { top: highY - 7, color: theme.colors.success }]}>
                {maxPrice.toFixed(2)}
              </Text>

              {/* LOW */}
              <View style={[styles.highlightLine, { left: minIdx * stepX, height: chartHeight }]} />
              <View style={[styles.highlightLineHorizontal, { top: lowY, width: drawingWidth }]} />

              <Text style={[styles.axisXText, { left: minDateLeft, top: lowY + 5, color: theme.colors.danger }]}>
                {new Date(history[minIdx].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>

              <Text style={[styles.axisText, { top: lowY - 7, color: theme.colors.danger }]}>
                {minPrice.toFixed(2)}
              </Text>

              {/* Fixed X Axis Dates (Positioned at bottom boundary) */}
              {showStartX && (
                <Text style={[styles.axisXText, { top: chartHeight + 5, left: 0 }]}>
                  {new Date(history[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
              {showMidX && (
                <Text style={[styles.axisXText, { top: chartHeight + 5, left: drawingWidth / 2 - 20, textAlign: 'center' }]}>
                  {new Date(history[Math.floor(history.length / 2)].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
              {showEndX && (
                <Text style={[styles.axisXText, { top: chartHeight + 5, left: drawingWidth - 40 }]}>
                  {new Date(history[history.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </>
          );
        })()}
      </View>
    );
  };

  const isUp = change >= 0;
  const color = isUp ? theme.colors.success : theme.colors.danger;

  const closePrices = history.map(q => q.close);
  const rsi = calculateRSI(closePrices);
  const macd = calculateMACD(closePrices);

  const formatNumber = (num: number) => {
    if (!num) return '-';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.name}>{name || symbol}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={[styles.addButton, { marginRight: 10 }]} onPress={() => setWlModalVisible(true)}>
            <Ionicons name="bookmark-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          {assetType !== 'INDEX' && (
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            {scrubIndex !== null && history[scrubIndex]
              ? formatCurrency(history[scrubIndex].close, currency)
              : formatCurrency(livePrice, currency)}
          </Text>
          <Text style={[styles.change, { color: scrubIndex !== null ? theme.colors.textSecondary : color }]}>
            {scrubIndex !== null && history[scrubIndex]
              ? new Date(history[scrubIndex].date).toLocaleDateString()
              : `${isUp ? '+' : ''}${parseFloat(change).toFixed(2)} (${isUp ? '+' : ''}${parseFloat(pct).toFixed(2)}%)`}
          </Text>
        </View>

        <View style={styles.tabsContainer}>
          {['Chart', 'Technicals', 'Fundamentals'].map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Chart' && (
          <View>
            <View style={styles.rangeSelector}>
              {['1mo', '3mo', '6mo', '1y', '5y'].map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRange(r)}
                  style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
                >
                  <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.chartContainer}>
              {loading ? (
                <ActivityIndicator size="large" color={theme.colors.primary} />
              ) : (
                renderCandlestick()
              )}
            </View>
          </View>
        )}

        {activeTab === 'Technicals' && (
          <View style={styles.contentContainer}>
            <Text style={styles.sectionTitle}>Indicators ({range})</Text>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Relative Strength Index (14)</Text>
              <Text style={styles.dataValue}>{rsi}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>MACD (12, 26)</Text>
              <Text style={styles.dataValue}>{macd}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Trend Signal</Text>
              <Text style={[styles.dataValue, { color: parseFloat(rsi) > 50 ? theme.colors.success : theme.colors.danger }]}>
                {parseFloat(rsi) > 70 ? 'OVERBOUGHT' : parseFloat(rsi) < 30 ? 'OVERSOLD' : parseFloat(rsi) > 50 ? 'BULLISH' : 'BEARISH'}
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'Fundamentals' && (
          <View style={styles.contentContainer}>
            <Text style={styles.sectionTitle}>Key Statistics</Text>
            {summary && summary.summaryDetail ? (
              <View style={styles.statGrid}>
                <BlurView intensity={theme.blur.intensity} tint={theme.blur.tint} style={styles.statBox}>
                  <Text style={styles.statLabel}>Market Cap</Text>
                  <Text style={styles.statValue}>
                    {summary.summaryDetail.marketCap ? formatCurrency(summary.summaryDetail.marketCap, currency) : '-'}
                  </Text>
                </BlurView>
                <BlurView intensity={theme.blur.intensity} tint={theme.blur.tint} style={styles.statBox}>
                  <Text style={styles.statLabel}>Volume (24h)</Text>
                  <Text style={styles.statValue}>
                    {summary.summaryDetail.volume ? formatNumber(summary.summaryDetail.volume) : '-'}
                  </Text>
                </BlurView>
                <BlurView intensity={theme.blur.intensity} tint={theme.blur.tint} style={styles.statBox}>
                  <Text style={styles.statLabel}>52-Week High</Text>
                  <Text style={styles.statValue}>
                    {summary.summaryDetail.fiftyTwoWeekHigh ? formatCurrency(summary.summaryDetail.fiftyTwoWeekHigh, currency) : '-'}
                  </Text>
                </BlurView>
                <BlurView intensity={theme.blur.intensity} tint={theme.blur.tint} style={styles.statBox}>
                  <Text style={styles.statLabel}>52-Week Low</Text>
                  <Text style={styles.statValue}>
                    {summary.summaryDetail.fiftyTwoWeekLow ? formatCurrency(summary.summaryDetail.fiftyTwoWeekLow, currency) : '-'}
                  </Text>
                </BlurView>
                <BlurView intensity={theme.blur.intensity} tint={theme.blur.tint} style={styles.statBox}>
                  <Text style={styles.statLabel}>P/E Ratio</Text>
                  <Text style={styles.statValue}>
                    {summary.summaryDetail.trailingPE?.toFixed(2) || 'N/A'}
                  </Text>
                </BlurView>
                <BlurView intensity={theme.blur.intensity} tint={theme.blur.tint} style={styles.statBox}>
                  <Text style={styles.statLabel}>Dividend Yield</Text>
                  <Text style={styles.statValue}>
                    {summary.summaryDetail.dividendYield ? (summary.summaryDetail.dividendYield * 100).toFixed(2) + '%' : 'N/A'}
                  </Text>
                </BlurView>
              </View>
            ) : (
              <Text style={styles.errorText}>Fundamental data not available.</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Portfolio Add Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order: {name || symbol}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              <TouchableOpacity
                style={[styles.toggleBtn, transactionType === 'BUY' && styles.toggleBtnActive]}
                onPress={() => setTransactionType('BUY')}
              >
                <Text style={[styles.toggleBtnText, transactionType === 'BUY' && styles.toggleBtnTextActive]}>Buy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, transactionType === 'SELL' && styles.toggleBtnActive, { borderLeftWidth: 0 }]}
                onPress={() => setTransactionType('SELL')}
              >
                <Text style={[styles.toggleBtnText, transactionType === 'SELL' && styles.toggleBtnTextActive]}>Sell</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Purchase Price ({currency})</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={priceStr}
              onChangeText={setPriceStr}
              placeholderTextColor={theme.colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={quantityStr}
              onChangeText={setQuantityStr}
              placeholderTextColor={theme.colors.textSecondary}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddPortfolio}>
              <Text style={styles.submitBtnText}>Add Position</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Watchlist Modal */}
      <Modal visible={wlModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Watchlist</Text>
            {watchlists.length === 0 ? (
              <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>No watchlists exist.</Text>
            ) : (
              watchlists.map(wl => (
                <TouchableOpacity key={wl.id} style={styles.modalBtn} onPress={() => handleAddWatchlist(wl.id)}>
                  <Text style={styles.modalBtnText}>{wl.name}</Text>
                </TouchableOpacity>
              ))
            )}

            <View style={{ flexDirection: 'row', marginTop: 15, marginBottom: 15 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                placeholder="New Watchlist Name"
                placeholderTextColor={theme.colors.textSecondary}
                value={newWatchlistName}
                onChangeText={setNewWatchlistName}
              />
              <TouchableOpacity
                style={[styles.submitBtn, { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingHorizontal: 15 }]}
                onPress={handleCreateWatchlist}
              >
                <Text style={styles.submitBtnText}>Create</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#333' }]} onPress={() => setWlModalVisible(false)}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chartContainer: {
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
  },
  scrubIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  scrubLine: {
    width: 1,
    position: 'absolute',
  },
  scrubDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.text,
    position: 'absolute',
    top: -5,
  },
  backButton: { padding: 4 },
  addButton: { padding: 4 },
  symbol: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  name: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  priceContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  price: {
    color: theme.colors.text,
    fontSize: 48,
    fontWeight: 'bold',
  },
  change: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    width: '48%',
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.card,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  tabTextActive: {
    color: theme.colors.text,
  },
  rangeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  rangeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  rangeBtnActive: {
    backgroundColor: theme.colors.surface,
  },
  rangeText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  rangeTextActive: {
    color: theme.colors.primary,
  },
  chartContainer: {
    height: 250,
    marginHorizontal: 20,
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dataLabel: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  dataValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  axisText: {
    position: 'absolute',
    right: 10,
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  axisXText: {
    position: 'absolute',
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#333',
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  highlightLine: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#aaa',
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  highlightLineHorizontal: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#aaa',
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  highlightText: {
    position: 'absolute',
    fontSize: 9,
    color: '#aaa',
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBtnText: {
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleBtnText: {
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  toggleBtnTextActive: {
    color: theme.colors.background,
  },
  modalSubtitle: {
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
