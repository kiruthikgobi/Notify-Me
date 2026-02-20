
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  TENANT_USER = 'TENANT_USER',
  TENANT_VIEWER = 'TENANT_VIEWER',
}

export enum AccessLevel {
  READ_ONLY = 'READ_ONLY',
  FULL_ACCESS = 'FULL_ACCESS',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  PRO = 'PRO',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum ComplianceType {
  RC = 'Registration Certificate',
  INSURANCE = 'Insurance',
  POLLUTION = 'Pollution (PUC)',
  PERMIT = 'National Permit',
  FITNESS = 'Fitness Certificate',
}

export interface Company {
  id: string;
  company_name: string;
  subscription_plan: SubscriptionPlan;
  status: TenantStatus;
  created_at: string;
  name?: string;
  plan?: SubscriptionPlan;
  subscriptionExpiry?: string;
}

export interface Tenant extends Company {
  name: string;
  plan: SubscriptionPlan;
  subscriptionExpiry?: string;
}

export interface Profile {
  id: string;
  company_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  access_level: AccessLevel | null;
  status: TenantStatus;
}

export interface Vehicle {
  id: string;
  company_id: string;
  vehicle_number: string;
  make: string;
  model: string;
  year: number;
  type: string;
  rc_expiry_date: string;
  insurance_expiry_date: string;
  pollution_expiry_date: string;
  created_at: string;
  isDraft?: boolean;
}

export interface ComplianceRecord {
  id: string;
  vehicleId: string;
  tenantId: string;
  type: string | ComplianceType;
  expiryDate: string;
  lastRenewedDate?: string;
  alertEnabled: boolean;
  alertDaysBefore: number;
  isDraft: boolean;
  documentName?: string;
  documentUrl?: string;
}

export interface ComplianceAuditInsight {
  status: 'Critical' | 'Warning' | 'Healthy';
  summary: string;
  recommendations: string[];
}

export interface VehicleMake {
  id: string;
  name: string;
}

export interface GlobalAutomationConfig {
  tenantId: string;
  recipients: string[];
  defaultThresholds: number[];
  enabled: boolean;
}

export interface AlertRecipient {
  id: string;
  company_id: string;
  email: string;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  company_id: string;
  vehicle_reg: string;
  doc_type: string;
  recipient: string;
  status: 'SENT' | 'FAILED';
  timestamp: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}
