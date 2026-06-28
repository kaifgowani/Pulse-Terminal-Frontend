import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Dimensions, TextInput, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssets } from '../store/slices/assetsSlice';
import { RootState, AppDispatch } from '../store/store';
import { FlashList } from '@shopify/flash-list';
import Sparkline from '../components/Sparkline';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { formatCurrency } from '../utils/formatCurrency';
import { formatCurrency } from '../utils/formatCurrency';
import { API_URL } from '../utils/config';
import { fetchApi } from '../utils/apiClient';
const CATEGORIES = ['Indices', 'Stocks', 'ETFs', 'Bonds', 'Crypto', 'Currencies', 'Commodities'];

export default function MarketsScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { assets, status, error } = useSelector((state: RootState) => state.assets);

  const [activeCategory, setActiveCategory] = useState('Indices');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch regular category assets
  useEffect(() => {
    if (searchQuery.length > 0) return;
    dispatch(fetchAssets({ category: activeCategory }));
    const interval = setInterval(() => dispatch(fetchAssets({ category: activeCategory })), 10000);
    return () => clearInterval(interval);
  }, [dispatch, activeCategory, searchQuery]);

  // Handle Search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchApi(`/api/assets/search/${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const renderAsset = ({ item }: { item: any }) => {
    // Search results have slightly different keys than real assets
    const symbol = item.symbol;
    const name = item.name || item.shortname || item.longname || symbol;
    const price = item.currentPrice || item.regularMarketPrice || 0;
    const changeAbs = item.changeAbs || item.regularMarketChange || 0;
    const changePct = item.changePct !== undefined ? item.changePct : (item.regularMarketChangePercent || 0);
    
    const isPositive = changePct >= 0;
    const color = isPositive ? theme.colors.success : theme.colors.danger;
    const sign = isPositive ? '+' : '';

    return (
      <TouchableOpacity 
        style={styles.assetRow} 
        onPress={() => navigation.navigate('AssetDetail', { 
          symbol, name, price, change: changeAbs, pct: changePct, currency: item.currency 
        })}
      >
        <View style={styles.colSymbol}>
          <Text style={styles.assetName} numberOfLines={1}>{name || symbol}</Text>
        </View>
        
        <View style={styles.colChart}>
          {item.sparkline && item.sparkline.length > 0 ? (
            <Sparkline data={item.sparkline} width={80} height={40} color={color} />
          ) : (
            <Text style={{color: '#444', fontSize: 10}}>NO CHART</Text>
          )}
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

  const dataToShow = searchQuery.length >= 2 ? searchResults : assets;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MARKETS</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{marginLeft: 10}} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tickers, companies..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{marginRight: 10}}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {!searchQuery && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer} contentContainerStyle={{paddingHorizontal: 15}}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.categoryPill, activeCategory === cat && styles.categoryPillActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colSymbol]}>ASSET</Text>
        <Text style={[styles.tableHeaderText, styles.colChart]}>TREND</Text>
        <Text style={[styles.tableHeaderText, styles.colPrice, { textAlign: 'right' }]}>PRICE/24H</Text>
      </View>

      {(status === 'loading' || isSearching) && dataToShow.length === 0 && (
        <Text style={styles.loadingText}>Fetching data stream...</Text>
      )}
      {status === 'failed' && !searchQuery && <Text style={styles.errorText}>ERR: {error}</Text>}
      
      <View style={{ flex: 1, width: '100%' }}>
        <FlashList
          data={dataToShow}
          renderItem={renderAsset}
          estimatedItemSize={70}
          keyExtractor={(item, index) => item.symbol || String(index)}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 15,
    borderRadius: 8,
    height: 40,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryPillActive: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  categoryText: {
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  categoryTextActive: {
    color: theme.colors.primary,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tableHeaderText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  assetRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  colSymbol: {
    flex: 2,
    justifyContent: 'center',
  },
  colChart: {
    flex: 1.5,
    alignItems: 'center',
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
  loadingText: {
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'monospace',
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'monospace',
  },
});
