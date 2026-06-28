import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  user: { id: string; email: string } | null;
}

const initialState: AuthState = {
  token: null,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ token: string; user: { id: string; email: string } }>) => {
      AsyncStorage.setItem('token', action.payload.token).catch(console.error);
      AsyncStorage.setItem('user', JSON.stringify(action.payload.user)).catch(console.error);
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    logout: (state) => {
      AsyncStorage.removeItem('token').catch(console.error);
      AsyncStorage.removeItem('user').catch(console.error);
      state.token = null;
      state.user = null;
    }
  },
});

export const { setAuth, logout } = authSlice.actions;
export default authSlice.reducer;
