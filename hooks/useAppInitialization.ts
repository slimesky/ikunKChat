import { useEffect } from 'react';
import { initDB, migrateAttachmentsFromLocalStorage } from '../services/indexedDBService';

interface UseAppInitializationReturn {
  getLatestVersion: () => any;
}

/**
 * AppInitialization Hook - 处理应用初始化相关逻辑
 * 职责：数据库初始化、PWA更新管理
 */
export const useAppInitialization = (): UseAppInitializationReturn => {
  // 初始化数据库
  useEffect(() => {
    const initStorage = async () => {
      try {
        await initDB();
        await migrateAttachmentsFromLocalStorage();
      } catch (error) {
        // Silent fail - 数据库初始化失败不应该影响应用启动
        console.warn('Database initialization failed:', error);
      }
    };
    initStorage();
  }, []);

  return {
    getLatestVersion: () => null
  };
};