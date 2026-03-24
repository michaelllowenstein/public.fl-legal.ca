
import { HttpInterceptorFn } from '@angular/common/http';
import { env } from '@env/environment';
import { EditorService } from '@services/editor';
import { AuthService } from '@services/auth';
import { inject } from '@angular/core';
/**
 * Attaches the appropriate Bearer token to every outbound API call.
 *
 * Logic:
 *   1. If the request is not going to our API, pass through unchanged.
 *   2. Lawyer token takes priority (calendar routes).
 *   3. Editor token used for content PATCH routes.
 *   4. If neither is present, pass through — public routes need no auth.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept requests to our own API
  if (!req.url.startsWith(env.apiURL)) return next(req);

  const auth: AuthService = inject(AuthService);
  const editor: EditorService = inject(EditorService);

  const token = auth.token() ?? editor.token();

  if (token) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};