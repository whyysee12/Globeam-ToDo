/**
 * Get the correct base URL for auth redirects based on environment
 */
export const getAuthRedirectURL = (): string => {
  // For production (Vercel)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  
  // For development
  return window.location.origin;
};

export const getResetPasswordURL = (): string => {
  return `${getAuthRedirectURL()}/reset-password`;
};
