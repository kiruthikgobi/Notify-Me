
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  TENANT_MANAGER = 'TENANT_MANAGER', // Full Access: Fleet mgmt + Records
  TENANT_VIEWER = 'TENANT_VIEWER',   // Read Only: View only
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  PRO = 'PRO',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface Tenant {
  id: string;
  name: string;
  ownerEmail: string;
  plan: SubscriptionPlan;
  status: TenantStatus;
  createdAt: string;
  subscriptionExpiry?: string;
  paymentId?: string;
}

export enum ComplianceType {
  RC = 'RC Validity',
  PERMIT = 'Permit Validity',
  INSURANCE = 'Insurance Validity',
  NP_TAX = 'NP Tax',
  MV_TAX = 'MV Tax',
  FITNESS = 'Fitness Certificate',
  POLLUTION = 'Pollution (PUC)',
}

export interface ComplianceRecord {
  id: string;
  vehicleId: string;
  tenantId: string;
  type: ComplianceType;
  expiryDate: string;
  lastRenewedDate: string;
  documentName?: string;
  documentUrl?: string;
  alertEnabled: boolean;
  alertDaysBefore: number;
  lastAlertSentDate?: string | null;
  isDraft?: boolean;
  sentReminders?: number[];
}

export interface Vehicle {
  id: string;
  tenantId: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: 'Truck' | 'Bus' | 'Car' | 'Lorry';
  addedDate: string;
  isDraft?: boolean;
}

export interface VehicleMake {
  id: string;
  tenantId: string;
  name: string;
}

export interface GlobalAutomationConfig {
  tenantId: string;
  recipients: string[];
  defaultThresholds: number[];
  enabled: boolean;
  emailTemplate?: {
    subject: string;
    body: string;
  };
}

export interface NotificationLog {
  id: string;
  tenantId: string;
  vehicleReg: string;
  docType: string;
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

export interface ComplianceAuditInsight {
  status: 'Critical' | 'Warning' | 'Healthy';
  summary: string;
  recommendations: string[];
}
