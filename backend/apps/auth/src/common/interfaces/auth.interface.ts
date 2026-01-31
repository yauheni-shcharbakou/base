export interface AuthJwtPayload {
  id: string;
  login: string;
}

export interface AuthJwtPayloadParsed extends AuthJwtPayload {
  id: string;
  login: string;
  iat: number;
  exp: number;
  iss: string;
}
