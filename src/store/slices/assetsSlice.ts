import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import { API_URL } from '../../utils/config';
import { fetchApi } from '../../utils/apiClient';
export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  currency?: string;
  currentPrice: number;
  changeAbs: number;
  changePct: number;
  volume: number;
  sparkline: number[];
}

export interface AssetsState {
  assets: Asset[];
  categoryAssets: Record<string, Asset[]>;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: AssetsState = {
  assets: [],
  categoryAssets: {},
  status: 'idle',
  error: null,
};

export const fetchAssets = createAsyncThunk('assets/fetchAssets', async (category?: string) => {
  const url = category ? `/api/assets/real?category=${encodeURIComponent(category)}` : `/api/assets/real`;
  const response = await fetchApi(url);
  if (!response.ok) {
    throw new Error('Failed to fetch assets');
  }
  const data = await response.json();
  return { category: category || "All", data: data as Asset[] };
});

const assetsSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssets.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAssets.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.assets = action.payload.data;
        state.categoryAssets[action.payload.category] = action.payload.data;
      })
      .addCase(fetchAssets.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Something went wrong';
      });
  },
});

export default assetsSlice.reducer;
