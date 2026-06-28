import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Linking, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { Platform } from 'react-native';
import { API_URL } from '../utils/config';
import { fetchApi } from '../utils/apiClient';
interface NewsArticle {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
}

// Force cache invalidation v2
export const NewsScreen = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = async () => {
    try {
      const res = await fetchApi(`/api/news`);
      const data = await res.json();
      setNews(data);
    } catch (err) {
      console.error('Failed to fetch news', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNews();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNews();
  };

  const renderItem = ({ item }: { item: NewsArticle }) => {
    return (
      <TouchableOpacity 
        style={styles.cardContainer}
        onPress={() => Linking.openURL(item.link)}
      >
        <BlurView intensity={theme.blur.intensity} tint={theme.blur.tint} style={styles.card}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <View style={styles.meta}>
            <Text style={styles.publisher}>{item.publisher}</Text>
            <Text style={styles.date}>{item.providerPublishTime ? String(item.providerPublishTime).slice(0, 10) : 'Recent'}</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Global Market News</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={news}
          keyExtractor={item => item.uuid}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  card: {
    backgroundColor: 'transparent',
    padding: 16,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  publisher: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  date: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
});
