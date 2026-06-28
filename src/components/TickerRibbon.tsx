import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { theme } from '../theme';
import { formatCurrency } from '../utils/formatCurrency';

const { width } = Dimensions.get('window');

export const TickerRibbon = () => {
  const { assets } = useSelector((state: RootState) => state.assets);
  const [ribbonAssets, setRibbonAssets] = useState<any[]>([]);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (assets && assets.length > 0) {
      // Select top 10 assets to show in ribbon
      const sorted = [...assets].sort((a, b) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0)).slice(0, 10);
      // Duplicate to create infinite scroll effect
      setRibbonAssets([...sorted, ...sorted]);
    }
  }, [assets]);

  useEffect(() => {
    if (ribbonAssets.length > 0) {
      scrollX.setValue(0);
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: 1, // We will interpolate this
          duration: 30000, // 30 seconds for a full sweep
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [ribbonAssets]);

  if (ribbonAssets.length === 0) return null;

  const translateX = scrollX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2000] // Roughly estimate width of 10 items to loop smoothly
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ribbon, { transform: [{ translateX }] }]}>
        {ribbonAssets.map((asset, index) => {
          const change = asset.changePct ?? (asset.regularMarketChangePercent || 0);
          const isPositive = change >= 0;
          const color = isPositive ? theme.colors.success : theme.colors.danger;
          const price = asset.currentPrice || asset.regularMarketPrice || 0;

          return (
            <View key={`${asset.symbol}-${index}`} style={styles.item}>
              <Text style={styles.symbol}>{asset.name || asset.shortname || asset.longname || asset.symbol}</Text>
              <Text style={styles.price}>{formatCurrency(price, asset.currency || 'USD')}</Text>
              <Text style={[styles.change, { color }]}>
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRightWidth: 1,
    borderRightColor: '#222',
  },
  symbol: {
    color: '#999',
    fontWeight: 'bold',
    marginRight: 8,
    fontSize: 12,
  },
  price: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 8,
    fontSize: 12,
  },
  change: {
    fontWeight: 'bold',
    fontSize: 12,
  }
});
