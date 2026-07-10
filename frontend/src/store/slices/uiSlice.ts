import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  language: 'en' | 'ar';
  direction: 'ltr' | 'rtl';
}

const initialState: UIState = {
  sidebarCollapsed: false,
  theme: 'dark',
  language: (localStorage.getItem('lang') as 'en' | 'ar') || 'en',
  direction: (localStorage.getItem('lang') === 'ar' ? 'rtl' : 'ltr'),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setLanguage: (state, action: PayloadAction<'en' | 'ar'>) => {
      state.language = action.payload;
      state.direction = action.payload === 'ar' ? 'rtl' : 'ltr';
      localStorage.setItem('lang', action.payload);
    },
    toggleLanguage: (state) => {
      state.language = state.language === 'en' ? 'ar' : 'en';
      state.direction = state.language === 'ar' ? 'rtl' : 'ltr';
      localStorage.setItem('lang', state.language);
    },
  },
});

export const { toggleSidebar, setLanguage, toggleLanguage } = uiSlice.actions;
export default uiSlice.reducer;
