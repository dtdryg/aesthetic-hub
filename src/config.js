// src/config.js
export const CFG = {
  USE_WALLET_LOGIN: import.meta.env.VITE_USE_WALLET_LOGIN === 'true',
  USE_WEB2_LOGIN: import.meta.env.VITE_USE_WEB2_LOGIN === 'true',
  USE_WEB3_STORAGE: import.meta.env.VITE_USE_WEB3_STORAGE === 'true',
  WEB3_STORAGE_TOKEN: import.meta.env.VITE_WEB3_STORAGE_TOKEN || '',
  USE_XMTP: import.meta.env.VITE_USE_XMTP === 'true',
  API: 'https://aesthetic-hub-production.up.railway.app',
};
