import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatCurrency';
import { API_URL } from '../utils/config';
import { fetchApi } from '../utils/apiClient';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
  currency?: string;
  name?: string;
}

interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
}

export const PortfolioScreen = () => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  const renderHeader = (title: string) => (
    <View style={styles.headerContainer}>
      <Text style={styles.header}>{title}</Text>
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={24} color={theme.colors.danger} />
      </TouchableOpacity>
    </View>
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchApi(`/api/portfolio`)
        .then(res => res.json())
        .then(data => {
          setPortfolio(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch portfolio', err);
          setLoading(false);
        });
    }, [])
  );

  const renderItem = (item: Position) => {
    const currentPrice = item.currentPrice || item.avgPrice;
    const currentValue = currentPrice * item.quantity;
    const profitLoss = (currentPrice - item.avgPrice) * item.quantity;
    const isProfit = profitLoss >= 0;

    return (
      <TouchableOpacity 
        key={item.id} 
        style={styles.card}
        onPress={() => navigation.navigate('AssetDetail', { symbol: item.symbol, name: item.name || item.symbol, price: currentPrice, currency: item.currency })}
      >
        <View style={styles.row}>
          <Text style={styles.symbol}>{item.name || item.symbol}</Text>
          <Text style={styles.value}>{formatCurrency(currentValue, item.currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.details}>{item.quantity} shares @ {formatCurrency(item.avgPrice, item.currency)}</Text>
          <Text style={[styles.pl, { color: isProfit ? theme.colors.success : theme.colors.danger }]}>
            {isProfit ? '+' : ''}{formatCurrency(profitLoss, item.currency)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader(portfolio?.name || 'My Portfolio')}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader(portfolio?.name || 'My Portfolio')}
        <View style={styles.center}>
          <Text style={styles.emptyText}>No positions yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Group by Currency
  const currencyGroups = portfolio.positions.reduce((acc, pos) => {
    const ccy = pos.currency || 'USD';
    if (!acc[ccy]) acc[ccy] = [];
    acc[ccy].push(pos);
    return acc;
  }, {} as Record<string, Position[]>);

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader(portfolio.name)}
      <ScrollView contentContainerStyle={styles.list}>
        {Object.keys(currencyGroups).map(currency => {
          const positions = currencyGroups[currency];
          const totalValue = positions.reduce((sum, pos) => sum + ((pos.currentPrice || pos.avgPrice) * pos.quantity), 0);
          
          return (
            <View key={currency} style={{ marginBottom: 30 }}>
              <BlurView 
                intensity={theme.blur.intensity} 
                tint={theme.blur.tint} 
                style={styles.summaryContainer}
              >
                <LinearGradient
                  colors={theme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  opacity={0.15}
                />
                <Text style={styles.summaryLabel}>{currency} Portfolio Value</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalValue, currency)}</Text>
              </BlurView>
              <FlatList data={positions} renderItem={({item}) => renderItem(item)} keyExtractor={(item) => item.id} scrollEnabled={false} />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 5,
  },
  summaryContainer: {
    padding: 20,
    backgroundColor: 'transparent',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  summaryValue: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  symbol: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  value: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  details: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  pl: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
