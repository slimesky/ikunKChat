import { useState, useEffect } from 'react';
import { usePWAUpdate } from './usePWAUpdate';
import { useUpdateService } from '../services/updateService';
import { initDB, migrateAttachmentsFromLocalStorage } from '../services/indexedDBService';

interface UseAppInitializationReturn {
  // PWA更新相关
  needRefresh: boolean;
  updateStatus: string;
  updateServiceWorker: () => void;
  checkForUpdates: () => Promise<any>;
  showUpdateNotice: boolean;
  isCheckingUpdate: boolean;
  handleUpdateNow: () => void;
  handleCheckForUpdates: () => Promise<any>;
  handleCloseUpdateNotice: () => void;
  handleDismissUpdateNotice: () => void;
  getLatestVersion: () => any;
}

/**
 * AppInitialization Hook - 处理应用初始化相关逻辑
 * 职责：数据库初始化、PWA更新管理
 */
export const useAppInitialization = (): UseAppInitializationReturn => {
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // PWA更新相关Hook
  const { needRefresh, updateStatus, updateServiceWorker, checkForUpdates } = usePWAUpdate();
  
  // 更新服务
  const {
    getLatestVersion,
    markVersionAsRead,
    dismissVersion,
    shouldShowUpdateNotice
  } = useUpdateService();

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

  // 检查是否应该显示更新通知
  useEffect(() => {
    const shouldShow = shouldShowUpdateNotice();
    if (shouldShow) {
      const latestVersion = getLatestVersion();
      if (latestVersion) {
        setShowUpdateNotice(true);
      }
    }
  }, [shouldShowUpdateNotice, getLatestVersion]);

  // 处理立即更新
  const handleUpdateNow = () => {
    updateServiceWorker();
  };

  // 处理检查更新
  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      return await checkForUpdates();
    } catch (error) {
      console.error('Check for updates failed:', error);
      throw error;
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // 处理关闭更新通知
  const handleCloseUpdateNotice = () => {
    const latestVersion = getLatestVersion();
    if (latestVersion) {
      markVersionAsRead(latestVersion.version);
    }
    setShowUpdateNotice(false);
  };

  // 处理忽略更新通知
  const handleDismissUpdateNotice = () => {
    const latestVersion = getLatestVersion();
    if (latestVersion) {
      dismissVersion(latestVersion.version);
    }
    setShowUpdateNotice(false);
  };

  return {
    needRefresh,
    updateStatus,
    updateServiceWorker,
    checkForUpdates,
    showUpdateNotice,
    isCheckingUpdate,
    handleUpdateNow,
    handleCheckForUpdates,
    handleCloseUpdateNotice,
    handleDismissUpdateNotice,
    getLatestVersion
  };
};