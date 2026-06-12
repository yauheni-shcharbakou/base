export interface AuthTokenPayload {
  id: string;
  login: string;
}

export interface AuthTokenPayloadParsed extends AuthTokenPayload {
  refresh?: true;
  iat: number;
  exp: number;
  iss: string;
}
