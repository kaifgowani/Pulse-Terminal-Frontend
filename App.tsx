import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store, RootState } from './src/store/store';
import { setAuth } from './src/store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CommandCenterScreen from './src/screens/CommandCenterScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { NewsScreen } from './src/screens/NewsScreen';
import WatchlistScreen from './src/screens/WatchlistScreen';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { theme } from './src/theme';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#222',
        },
        tabBarActiveTintColor: '#00E676',
        tabBarInactiveTintColor: '#666',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'help-circle';
          if (route.name === 'Terminal') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Watchlists') {
            iconName = focused ? 'star' : 'star-outline';
          } else if (route.name === 'Portfolio') {
            iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          } else if (route.name === 'News') {
            iconName = focused ? 'newspaper' : 'newspaper-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Terminal" component={CommandCenterScreen} />
      <Tab.Screen name="Watchlists" component={WatchlistScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="News" component={NewsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const token = useSelector((state: RootState) => state.auth.token);
  const dispatch = useDispatch();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');
        if (storedToken && storedUser) {
          dispatch(setAuth({ token: storedToken, user: JSON.parse(storedUser) }));
        }
      } catch (e) {
        console.error('Failed to load auth', e);
      } finally {
        setIsReady(true);
      }
    };
    loadAuth();
  }, [dispatch]);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen name="AssetDetail" component={AssetDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <RootNavigator />
      <StatusBar style="light" />
    </Provider>
  );
}
