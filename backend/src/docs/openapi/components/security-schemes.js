export const securitySchemes = {
  accessCookie: {
    type: 'apiKey',
    in: 'cookie',
    name: 'accessToken',
    description:
      'HttpOnly access-token cookie set by login or refresh. Browser JavaScript and Swagger UI cannot read its value; the browser sends it when credentials are included.',
  },
  refreshCookie: {
    type: 'apiKey',
    in: 'cookie',
    name: 'refreshToken',
    description:
      'HttpOnly rotating refresh-token cookie scoped to authentication routes. It is sent automatically by the browser with credentialed refresh requests.',
  },
  csrfToken: {
    type: 'apiKey',
    in: 'header',
    name: 'X-CSRF-Token',
    description:
      'CSRF token returned in data.csrfToken by GET {API_PREFIX}/auth/csrf-token. Send it on every unsafe request while retaining the associated CSRF cookie.',
  },
};
