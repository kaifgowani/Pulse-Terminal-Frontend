import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Platform, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../utils/config';
import { fetchApi } from '../utils/apiClient';
import { theme } from '../theme';

interface AlertNotification {
  id: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export const AlertsScreen = () => {
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [symbol, setSymbol] = useState('');
  const [condition, setCondition] = useState('GREATER_THAN'); // GREATER_THAN, LESS_THAN, DIVERGENCE
  const [targetValue, setTargetValue] = useState('');
  const [relatedSymbol, setRelatedSymbol] = useState('');

  const fetchNotifications = async () => {
    try {
      const res = await fetchApi(`/api/alerts/notifications`);
      const data = await res.json();
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateAlert = async () => {
    if (!symbol) {
      if (Platform.OS === 'web') alert('Symbol is required');
      else Alert.alert('Error', 'Symbol is required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetchApi(`/api/alerts/rules`, {
        method: 'POST',
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          condition,
          targetValue: targetValue ? parseFloat(targetValue) : null,
          relatedSymbol: relatedSymbol ? relatedSymbol.toUpperCase() : null
        })
      });
      if (res.ok) {
        setModalVisible(false);
        setSymbol('');
        setTargetValue('');
        setRelatedSymbol('');
        if (Platform.OS === 'web') alert('Alert created successfully!');
        else Alert.alert('Success', 'Alert created successfully!');
      } else {
        const err = await res.json();
        if (Platform.OS === 'web') alert(err.error || 'Failed to create');
        else Alert.alert('Error', err.error || 'Failed to create');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({ item }: { item: AlertNotification }) => (
    <View style={[styles.notificationCard, !item.isRead && styles.unreadCard]}>
      <Ionicons name="warning" size={24} color="#F5A623" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Alerts Engine</Text>
      </View>

      {loading ? (
        <Text style={styles.loading}>Connecting to Engine...</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No alerts triggered yet.</Text>}
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#000" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Alert</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Primary Asset Symbol</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. AAPL, ^GSPC, BTC-USD"
                placeholderTextColor={theme.colors.textSecondary}
                value={symbol}
                onChangeText={setSymbol}
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Condition</Text>
              <View style={styles.conditionRow}>
                {['GREATER_THAN', 'LESS_THAN', 'DIVERGENCE'].map((c) => (
                  <TouchableOpacity 
                    key={c}
                    style={[styles.conditionBtn, condition === c && styles.conditionBtnActive]}
                    onPress={() => setCondition(c)}
                  >
                    <Text style={[styles.conditionText, condition === c && styles.conditionTextActive]}>
                      {c.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {condition !== 'DIVERGENCE' && (
                <>
                  <Text style={styles.label}>Target Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 150.00"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={targetValue}
                    onChangeText={setTargetValue}
                    keyboardType="numeric"
                  />
                </>
              )}

              {condition === 'DIVERGENCE' && (
                <>
                  <Text style={styles.label}>Related Asset Symbol</Text>
                  <Text style={styles.helperText}>Alert triggers if Primary goes UP while Related goes DOWN today.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. ^GSPC"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={relatedSymbol}
                    onChangeText={setRelatedSymbol}
                    autoCapitalize="characters"
                  />
                </>
              )}

              <TouchableOpacity 
                style={[styles.createBtn, creating && styles.createBtnDisabled]} 
                onPress={handleCreateAlert}
                disabled={creating}
              >
                <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create Alert'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00E676',
  },
  loading: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  list: {
    padding: 20,
    paddingBottom: 100, // Space for FAB
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#333',
  },
  unreadCard: {
    borderLeftColor: '#F5A623',
    backgroundColor: '#222',
  },
  icon: {
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
  time: {
    color: '#888',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#00E676',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    marginBottom: 20,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 15,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 16,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  conditionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  conditionBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  conditionText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  conditionTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
  createBtn: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  createBtnDisabled: {
    opacity: 0.7,
  },
  createBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
