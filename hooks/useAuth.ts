/**
 * 由于站点不再需要访问密码，认证逻辑被精简为始终允许访问。
 */
export const useAuth = () => ({
  isAuthenticated: true,
  hasPassword: false,
  handleVerified: () => undefined,
});
