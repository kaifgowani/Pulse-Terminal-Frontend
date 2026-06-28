import { Platform } from 'react-native';

export const API_URL = Platform.OS === 'web' ? 'https://pulse-terminal-backend.onrender.com/api' : 'https://pulse-terminal-backend.onrender.com/api';
