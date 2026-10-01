// Where the browser posts to end its session: the route handler's own path, named here for the
// auth provider that submits to it and the middleware that lets it through. No imports, so both a
// client module and the middleware can read it.
export const LOGOUT_PATH = '/api/auth/logout';
