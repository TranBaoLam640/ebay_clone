import {
  body,
  object,
  operation,
  ref,
  response,
  security,
} from '../components/index.js';

export const userPaths = {
  '/users/me': {
    get: operation({
      tag: 'Users',
      operationId: 'getCurrentUser',
      summary: 'Get the current user',
      success: response('Current user', ref('UserProfile')),
      errors: [401, 429, 500],
      security: security.access,
    }),
    patch: operation({
      tag: 'Users',
      operationId: 'updateCurrentUser',
      summary: 'Update the current user',
      requestBody: body(
        object({
          fullName: { type: 'string', minLength: 1 },
          phone: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
        }),
      ),
      success: response('User updated', ref('UserProfile')),
      errors: [400, 401, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/users/me/password': {
    patch: operation({
      tag: 'Users',
      operationId: 'changeCurrentUserPassword',
      summary: 'Change the current user password',
      requestBody: body(
        object(
          {
            currentPassword: { type: 'string', format: 'password' },
            newPassword: { type: 'string', format: 'password', minLength: 8 },
          },
          ['currentPassword', 'newPassword'],
        ),
      ),
      errors: [400, 401, 413, 429, 500],
      security: security.unsafe,
    }),
  },
};
