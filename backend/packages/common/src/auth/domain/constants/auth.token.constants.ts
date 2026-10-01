export const getAuthTokenIssuer = (isDevelopment: boolean): string => {
  return isDevelopment ? 'Rayan Hosling' : 'Tyler Durden';
};

export const AUTH_TOKEN_ALGORITHM = 'RS256';
