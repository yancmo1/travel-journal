export const OPERATIONS_ADMIN_EMAIL = 'yancmo@gmail.com';

export function isOperationsAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === OPERATIONS_ADMIN_EMAIL;
}

export function isOperationsAdmin(user) {
  return isOperationsAdminEmail(user?.email);
}
