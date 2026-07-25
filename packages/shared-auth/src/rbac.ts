export type Permission =
  | 'ride:create'
  | 'ride:view'
  | 'ride:view_all'
  | 'ride:cancel'
  | 'ride:update_status'
  | 'ride:rate'
  | 'driver:register'
  | 'driver:go_online'
  | 'driver:subscribe'
  | 'driver:view_earnings'
  | 'driver:accept_ride'
  | 'admin:manage_users'
  | 'admin:manage_drivers'
  | 'admin:manage_vehicles'
  | 'admin:manage_subscriptions'
  | 'admin:manage_fares'
  | 'admin:manage_zones'
  | 'admin:view_analytics'
  | 'admin:manage_support'
  | 'admin:view_audit_logs'
  | 'finance:view_payments'
  | 'finance:process_refunds'
  | 'finance:manage_wallets'
  | 'safety:manage_incidents'
  | 'safety:emergency_actions'
  | 'safety:view_live_trips'
  | 'dispatch:assign_rides'
  | 'dispatch:view_live_map'
  | 'support:manage_tickets'
  | 'support:contact_users';

type UserRole =
  | 'passenger'
  | 'driver_applicant'
  | 'driver'
  | 'dispatcher'
  | 'support_agent'
  | 'finance_officer'
  | 'safety_officer'
  | 'ops_admin'
  | 'system_admin'
  | 'super_admin'
  | 'auditor';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  passenger: ['ride:create', 'ride:view', 'ride:cancel', 'ride:rate'],
  driver_applicant: ['driver:register'],
  driver: [
    'ride:view', 'ride:cancel', 'ride:update_status', 'driver:go_online',
    'driver:subscribe', 'driver:view_earnings', 'driver:accept_ride',
  ],
  dispatcher: [
    'ride:view_all', 'dispatch:assign_rides', 'dispatch:view_live_map',
    'support:contact_users',
  ],
  support_agent: [
    'ride:view_all', 'support:manage_tickets', 'support:contact_users',
    'admin:manage_users',
  ],
  finance_officer: [
    'finance:view_payments', 'finance:process_refunds', 'finance:manage_wallets',
    'admin:manage_subscriptions', 'admin:view_analytics',
  ],
  safety_officer: [
    'safety:manage_incidents', 'safety:emergency_actions', 'safety:view_live_trips',
    'ride:view_all', 'admin:manage_users',
  ],
  ops_admin: [
    'ride:view_all', 'admin:manage_users', 'admin:manage_drivers',
    'admin:manage_vehicles', 'admin:manage_subscriptions', 'admin:manage_fares',
    'admin:manage_zones', 'admin:view_analytics', 'admin:manage_support',
    'dispatch:assign_rides', 'dispatch:view_live_map',
  ],
  system_admin: [
    'ride:view_all', 'admin:manage_users', 'admin:manage_drivers',
    'admin:manage_vehicles', 'admin:manage_subscriptions', 'admin:manage_fares',
    'admin:manage_zones', 'admin:view_analytics', 'admin:manage_support',
    'admin:view_audit_logs', 'dispatch:assign_rides', 'dispatch:view_live_map',
    'finance:view_payments', 'safety:manage_incidents',
  ],
  super_admin: [
    'ride:create', 'ride:view', 'ride:view_all', 'ride:cancel', 'ride:update_status',
    'ride:rate',
    'driver:register', 'driver:go_online', 'driver:subscribe', 'driver:view_earnings',
    'driver:accept_ride', 'admin:manage_users', 'admin:manage_drivers',
    'admin:manage_vehicles', 'admin:manage_subscriptions', 'admin:manage_fares',
    'admin:manage_zones', 'admin:view_analytics', 'admin:manage_support',
    'admin:view_audit_logs', 'finance:view_payments', 'finance:process_refunds',
    'finance:manage_wallets', 'safety:manage_incidents', 'safety:emergency_actions',
    'safety:view_live_trips', 'dispatch:assign_rides', 'dispatch:view_live_map',
    'support:manage_tickets', 'support:contact_users',
  ],
  auditor: [
    'ride:view_all', 'admin:view_analytics', 'admin:view_audit_logs',
    'finance:view_payments',
  ],
};

export class RBACService {
  hasPermission(role: string, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role as UserRole];
    if (!permissions) return false;
    return permissions.includes(permission);
  }

  getPermissions(role: string): Permission[] {
    return ROLE_PERMISSIONS[role as UserRole] ?? [];
  }

  hasAnyPermission(role: string, permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(role, p));
  }

  hasAllPermissions(role: string, permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(role, p));
  }
}
