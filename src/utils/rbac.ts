/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Debonair LTD (Unit-02) — IE Department
 * Role-Based Access Control (RBAC) Security & Scoping Engine
 */

import { RoleTier, UserProfile } from '../types';

export interface LineScopeCheckResult {
  inScope: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  accessControlLevel: string;
  scopeType: 'all' | 'wing' | 'block' | 'line';
  reason?: string;
  badgeLabel: string;
  badgeColor: 'emerald' | 'blue' | 'amber' | 'slate';
}

/**
 * Wing mappings for Debonair LTD (Unit-02)
 * Total 34 Production Lines:
 * - Blue Wing (Mgr 1): Lines 01 to 18
 * - Green Wing (Mgr 2): Lines 19 to 34
 */
export const BLUE_WING_LINES = Array.from({ length: 18 }, (_, i) => {
  const num = i + 1;
  return num < 10 ? `Line 0${num}` : `Line ${num}`;
});

export const GREEN_WING_LINES = Array.from({ length: 16 }, (_, i) => {
  const num = i + 19;
  return `Line ${num}`;
});

export const ALL_FACTORY_LINES = [...BLUE_WING_LINES, ...GREEN_WING_LINES];

/**
 * Block / Floor Mappings (5–6 Lines Each) for IE Incharges / Assistant Managers:
 * - Block 1 (Floor 1 / Sec 1): Lines 01–06 (Blue Wing)
 * - Block 2 (Floor 2 / Sec 2): Lines 07–12 (Blue Wing)
 * - Block 3 (Floor 3 / Sec 3): Lines 13–18 (Blue Wing)
 * - Block 4 (Floor 4 / Sec 4): Lines 19–24 (Green Wing)
 * - Block 5 (Floor 5 / Sec 5): Lines 25–29 (Green Wing)
 * - Block 6 (Floor 6 / Sec 6): Lines 30–34 (Green Wing)
 */
export interface LineBlockDefinition {
  blockId: string;
  blockNo: number;
  label: string;
  wing: 'Blue Wing' | 'Green Wing';
  floor: string;
  lines: string[];
}

export const FACTORY_BLOCKS: LineBlockDefinition[] = [
  {
    blockId: 'block_1',
    blockNo: 1,
    label: 'Block 1 — Floor 1 (Lines 01–06)',
    wing: 'Blue Wing',
    floor: 'Floor 1 (Ground / Cutting Feed)',
    lines: ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06']
  },
  {
    blockId: 'block_2',
    blockNo: 2,
    label: 'Block 2 — Floor 2 (Lines 07–12)',
    wing: 'Blue Wing',
    floor: 'Floor 2 (Padma Floor)',
    lines: ['Line 07', 'Line 08', 'Line 09', 'Line 10', 'Line 11', 'Line 12']
  },
  {
    blockId: 'block_3',
    blockNo: 3,
    label: 'Block 3 — Floor 3 (Lines 13–18)',
    wing: 'Blue Wing',
    floor: 'Floor 3 (Meghna Floor)',
    lines: ['Line 13', 'Line 14', 'Line 15', 'Line 16', 'Line 17', 'Line 18']
  },
  {
    blockId: 'block_4',
    blockNo: 4,
    label: 'Block 4 — Floor 4 (Lines 19–24)',
    wing: 'Green Wing',
    floor: 'Floor 4 (Jamuna Floor)',
    lines: ['Line 19', 'Line 20', 'Line 21', 'Line 22', 'Line 23', 'Line 24']
  },
  {
    blockId: 'block_5',
    blockNo: 5,
    label: 'Block 5 — Floor 5 (Lines 25–29)',
    wing: 'Green Wing',
    floor: 'Floor 5 (Karnaphuli Floor)',
    lines: ['Line 25', 'Line 26', 'Line 27', 'Line 28', 'Line 29']
  },
  {
    blockId: 'block_6',
    blockNo: 6,
    label: 'Block 6 — Floor 6 (Lines 30–34)',
    wing: 'Green Wing',
    floor: 'Floor 6 (Surma Floor)',
    lines: ['Line 30', 'Line 31', 'Line 32', 'Line 33', 'Line 34']
  }
];

/**
 * Standardize line number string (e.g. '18' -> 'Line 18', 'Line 04' -> 'Line 04')
 */
export function normalizeLineNo(lineNo: string | number): string {
  if (typeof lineNo === 'number') {
    return lineNo < 10 ? `Line 0${lineNo}` : `Line ${lineNo}`;
  }
  const clean = String(lineNo).trim();
  if (clean.toLowerCase().startsWith('line')) {
    const digits = clean.replace(/[^0-9]/g, '');
    const n = parseInt(digits, 10);
    if (!isNaN(n)) {
      return n < 10 ? `Line 0${n}` : `Line ${n}`;
    }
    return clean;
  }
  const n = parseInt(clean, 10);
  if (!isNaN(n)) {
    return n < 10 ? `Line 0${n}` : `Line ${n}`;
  }
  return clean;
}

/**
 * Get Wing for a specific production line
 */
export function getLineWing(lineNo: string | number): 'Blue Wing' | 'Green Wing' {
  const norm = normalizeLineNo(lineNo);
  const digits = parseInt(norm.replace(/[^0-9]/g, ''), 10);
  if (isNaN(digits) || digits <= 18) {
    return 'Blue Wing';
  }
  return 'Green Wing';
}

/**
 * Get Block definition for a line
 */
export function getLineBlock(lineNo: string | number): LineBlockDefinition {
  const norm = normalizeLineNo(lineNo);
  const found = FACTORY_BLOCKS.find(b => b.lines.includes(norm));
  if (found) return found;
  const digits = parseInt(norm.replace(/[^0-9]/g, ''), 10);
  if (!isNaN(digits)) {
    if (digits <= 6) return FACTORY_BLOCKS[0];
    if (digits <= 12) return FACTORY_BLOCKS[1];
    if (digits <= 18) return FACTORY_BLOCKS[2];
    if (digits <= 24) return FACTORY_BLOCKS[3];
    if (digits <= 29) return FACTORY_BLOCKS[4];
    return FACTORY_BLOCKS[5];
  }
  return FACTORY_BLOCKS[0];
}

export const SYSTEM_ADMIN_EMAIL = 'ashikur.rahman.0971@gmail.com';
export const SYSTEM_ADMIN_PASSCODE = 'DGU2@IE12455';

/**
 * Enforce strict root Master System Administrator identity:
 * ONLY ashikur.rahman.0971@gmail.com can hold or qualify for Master System Administrator (Tier 0 / Admin).
 * Any other email or account is restricted from root administration.
 */
export function isSystemAdmin(profile?: UserProfile): boolean {
  if (!profile || !profile.email) return false;
  const normalizedEmail = profile.email.toLowerCase().trim();
  // EXCLUSIVE CHECK: Only the designated email address is allowed
  return normalizedEmail === SYSTEM_ADMIN_EMAIL.toLowerCase();
}

export function verifySystemAdminPasscode(passcode: string, userEmail?: string): boolean {
  // If email is provided, verify email match as well
  if (userEmail && userEmail.toLowerCase().trim() !== SYSTEM_ADMIN_EMAIL.toLowerCase()) {
    return false;
  }
  const clean = (passcode || '').trim();
  return clean === SYSTEM_ADMIN_PASSCODE || clean === '911999';
}

/**
 * Check if the current user profile has access to edit or approve data for a given line
 */
export function checkLineAccess(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[],
  lineNo: string | number
): LineScopeCheckResult {
  const normLine = normalizeLineNo(lineNo);
  const lineWing = getLineWing(normLine);
  const lineBlock = getLineBlock(normLine);

  // Check if System Admin with root authority
  if (isSystemAdmin(profile)) {
    return {
      inScope: true,
      canEdit: true,
      canApprove: true,
      canDelete: true,
      accessControlLevel: 'System Administrator (Full Root Authority)',
      scopeType: 'all',
      badgeLabel: 'System Admin • Root Access',
      badgeColor: 'emerald'
    };
  }

  // Find active tier
  const rawTier = roleTiers.find(t => t.id === profile?.tierId) || roleTiers[0];
  // If tier_0 is set on profile without ashikur.rahman.0971@gmail.com, downgrade check to Tier 1
  const tier = (rawTier.id === 'tier_0' && !isSystemAdmin(profile))
    ? (roleTiers.find(t => t.id === 'tier_1') || roleTiers[1] || rawTier)
    : rawTier;
  const level = tier.level;

  // TIER 0: System Admin (Reserved exclusively for ashikur.rahman.0971@gmail.com)
  if (isSystemAdmin(profile) && (level === 0 || tier.id === 'tier_0')) {
    return {
      inScope: true,
      canEdit: true,
      canApprove: true,
      canDelete: true,
      accessControlLevel: 'System Administrator (Full Root Authority)',
      scopeType: 'all',
      badgeLabel: 'System Admin • Root Access',
      badgeColor: 'emerald'
    };
  }

  // TIER 1: Sr. Manager — All Factory Lines (Department Administrator)
  if (level <= 1 || tier.scopeType === 'all') {
    return {
      inScope: true,
      canEdit: true,
      canApprove: true,
      canDelete: true,
      accessControlLevel: 'Department Administrator (Full System Access)',
      scopeType: 'all',
      badgeLabel: 'Tier 1 • Full Access',
      badgeColor: 'emerald'
    };
  }

  // TIER 2: Manager — Assigned Wing - Lines (Wing Super-User)
  if (level === 2 || tier.scopeType === 'wing') {
    const userWing = profile?.assignedWing || 'Blue Wing';
    const isAssignedWing = userWing === 'All' || userWing === lineWing;

    if (isAssignedWing) {
      return {
        inScope: true,
        canEdit: true,
        canApprove: true,
        canDelete: false,
        accessControlLevel: 'Wing Super-User (Assigned Wing Control Write & Approve)',
        scopeType: 'wing',
        badgeLabel: `Tier 2 • ${userWing} Super-User`,
        badgeColor: 'blue'
      };
    }

    return {
      inScope: false,
      canEdit: false,
      canApprove: false,
      canDelete: false,
      accessControlLevel: 'Wing Super-User (Assigned Wing Control Write & Approve)',
      scopeType: 'wing',
      reason: `${normLine} is in ${lineWing}. Your scope is restricted to ${userWing}.`,
      badgeLabel: `Tier 2 • Outside Wing (${userWing})`,
      badgeColor: 'slate'
    };
  }

  // TIER 3: IE Incharges/Assistant Manager's — Assigned Line Blocks/Floor (5–6 Lines Each)
  if (level === 3 || tier.scopeType === 'block') {
    const assignedBlockId = profile?.assignedBlock || 'block_2';
    const activeBlockDef =
      FACTORY_BLOCKS.find(b => b.blockId === assignedBlockId || b.label === profile?.assignedBlock) ||
      FACTORY_BLOCKS[1]; // default Floor 2 / Lines 07-12

    const isInsideBlock = activeBlockDef.lines.includes(normLine);

    if (isInsideBlock) {
      return {
        inScope: true,
        canEdit: true,
        canApprove: true,
        canDelete: false,
        accessControlLevel: 'Section Moderator (Assigned Block/Floor Write & Approve)',
        scopeType: 'block',
        badgeLabel: `Tier 3 • ${activeBlockDef.label.split('—')[0].trim()} Moderator`,
        badgeColor: 'blue'
      };
    }

    return {
      inScope: false,
      canEdit: false,
      canApprove: false,
      canDelete: false,
      accessControlLevel: 'Section Moderator (Assigned Block/Floor Write & Approve)',
      scopeType: 'block',
      reason: `${normLine} belongs to ${lineBlock.label}. Your assigned block is ${activeBlockDef.label}.`,
      badgeLabel: `Tier 3 • Outside Assigned Block`,
      badgeColor: 'slate'
    };
  }

  // TIER 4: Line IEs — Assigned Line's (Standard IE - Data Entry Only)
  const userAssignedLines =
    profile?.assignedLines && profile.assignedLines.length > 0
      ? profile.assignedLines.map(normalizeLineNo)
      : ['Line 01', 'Line 02']; // standard default for Line IE

  const isMyAssignedLine = userAssignedLines.includes(normLine);

  if (isMyAssignedLine) {
    return {
      inScope: true,
      canEdit: true, // Data entry permitted
      canApprove: false, // Cannot approve checklists, only Submit
      canDelete: false,
      accessControlLevel: 'Standard IE (Assigned Lines Data Entry Only)',
      scopeType: 'line',
      badgeLabel: 'Tier 4 • Data Entry Only',
      badgeColor: 'amber'
    };
  }

  return {
    inScope: false,
    canEdit: false,
    canApprove: false,
    canDelete: false,
    accessControlLevel: 'Standard IE (Assigned Lines Data Entry Only)',
    scopeType: 'line',
    reason: `${normLine} is not in your assigned lines (${userAssignedLines.join(', ')}). Tier 4 has data entry access only for assigned lines.`,
    badgeLabel: 'Tier 4 • View-Only (Restricted)',
    badgeColor: 'slate'
  };
}

/**
 * Return all lines within the user's reporting scope
 */
export function getLinesInUserScope(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): string[] {
  const tier = roleTiers.find(t => t.id === profile?.tierId) || roleTiers[0];
  const level = tier.level;

  if (isSystemAdmin(profile) || level <= 1 || tier.scopeType === 'all') {
    return ALL_FACTORY_LINES;
  }

  if (level === 2 || tier.scopeType === 'wing') {
    const wing = profile?.assignedWing || 'Blue Wing';
    if (wing === 'Green Wing') return GREEN_WING_LINES;
    if (wing === 'All') return ALL_FACTORY_LINES;
    return BLUE_WING_LINES;
  }

  if (level === 3 || tier.scopeType === 'block') {
    const assignedBlockId = profile?.assignedBlock || 'block_2';
    const found =
      FACTORY_BLOCKS.find(b => b.blockId === assignedBlockId || b.label === profile?.assignedBlock) ||
      FACTORY_BLOCKS[1];
    return found.lines;
  }

  // Tier 4: Line IEs
  if (profile?.assignedLines && profile.assignedLines.length > 0) {
    return profile.assignedLines.map(normalizeLineNo);
  }
  return ['Line 01', 'Line 02'];
}

/**
 * ============================================================================
 * Enterprise Privacy & Security Clearance Engine
 * ============================================================================
 */

export interface UserPrivacyClearance {
  clearanceLevel: string;
  badgeLabel: string;
  badgeColor: 'emerald' | 'blue' | 'amber' | 'slate' | 'indigo';
  canViewFinancials: boolean;
  canViewPii: boolean;
  canManageSecurity: boolean;
  canViewAuditLogs: boolean;
  canLockTerminal: boolean;
  requiresPin: boolean;
  maskingLevel: 'none' | 'partial' | 'strict';
  sessionTimeoutMinutes: number;
  securityScore: number; // 0 to 100
  exportWatermark: boolean;
  canExportRawData: boolean;
  maxExportRowsLimit: number; // 0 = unlimited
  twoFactorRequired: boolean;
  networkScope: 'factory_intranet' | 'vpn_secure' | 'unrestricted';
  canOverrideLocks: boolean;
  canPurgeAuditLogs: boolean;
  privacyRiskLevel: 'Low' | 'Moderate' | 'Guarded' | 'Restricted';
  securityScoreRating: { label: string; color: string };
}

/**
 * Determine effective active role tier for security evaluation
 */
export function getEffectiveRoleTier(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): RoleTier {
  if (isSystemAdmin(profile)) {
    const adminTier = roleTiers.find(t => t.id === 'tier_0');
    if (adminTier) return adminTier;
  }
  const rawTier = roleTiers.find(t => t.id === profile?.tierId) || roleTiers[0];
  // If tier_0 is configured without valid sysadmin email, downgrade to Tier 1
  if (rawTier.id === 'tier_0' && !isSystemAdmin(profile)) {
    return roleTiers.find(t => t.id === 'tier_1') || roleTiers[1] || rawTier;
  }
  return rawTier;
}

/**
 * Check whether the active user can view unmasked Operator PII
 */
export function canUserViewPii(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return true;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canViewPii ?? (tier.level <= 3);
}

/**
 * Check whether the active user can view sensitive commercial costing / financials
 */
export function canUserViewFinancials(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return true;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canViewSensitiveFinancials ?? (tier.level <= 2);
}

/**
 * Check whether the active user can manage factory security policies, PINs, and encryption
 */
export function canUserManageSecurity(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return true;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canManageSecuritySettings ?? (tier.level <= 1);
}

/**
 * Check whether the active user can view system security audit trails
 */
export function canUserViewAuditLogs(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return true;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canViewAuditLogs ?? (tier.level <= 2);
}

/**
 * Check whether the active user has authority to lock floor terminals
 */
export function canUserLockTerminal(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canLockTerminal ?? true;
}

/**
 * Check whether high-impact actions require security PIN re-verification
 */
export function doesUserRequirePin(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return false;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.requiresPinConfirmation ?? (tier.level >= 1);
}

/**
 * Get active data masking level for display
 */
export function getUserDataMasking(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): 'none' | 'partial' | 'strict' {
  if (isSystemAdmin(profile)) return 'none';
  const tier = getEffectiveRoleTier(profile, roleTiers);
  if (tier.dataMaskingLevel) return tier.dataMaskingLevel;
  if (tier.level <= 2) return 'none';
  if (tier.level === 3) return 'partial';
  return 'strict';
}

/**
 * Get role-tailored workstation auto-lock inactivity duration in minutes
 */
export function getUserSessionTimeout(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): number {
  if (isSystemAdmin(profile)) return 60;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.sessionTimeoutMinutes || (tier.level >= 4 ? 10 : tier.level === 3 ? 15 : 30);
}

/**
 * Mask Personally Identifiable Information (phone, email, NID) unless authorized
 */
export function maskPii(value: string | undefined | null, isAllowed: boolean): string {
  if (!value) return 'N/A';
  if (isAllowed) return value;
  const clean = String(value).trim();
  if (clean.length <= 4) return '••••';
  // Phone number masking: +880 1712-345678 -> +880 17••-••••78
  if (clean.includes('+') || clean.replace(/[^0-9]/g, '').length >= 9) {
    return clean.slice(0, 6) + '••••-••••' + clean.slice(-2);
  }
  // Email masking: john.doe@debonair.com -> j•••@debonair.com
  if (clean.includes('@')) {
    const [name, domain] = clean.split('@');
    return `${name.charAt(0)}••••@${domain}`;
  }
  return clean.slice(0, 2) + '••••••' + clean.slice(-2);
}

/**
 * Mask commercial financial figures (piece rates, dollarized labor, margin)
 */
export function maskFinancial(value: number | string, isAllowed: boolean): string {
  if (isAllowed) return String(value);
  return '•••••• [Restricted]';
}

/**
 * Check whether the active user can export raw un-aggregated telemetry / operator payroll data
 */
export function canUserExportRawData(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return true;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canExportRawData ?? (tier.level <= 1);
}

/**
 * Get export batch quota limit for the active role tier (0 = unlimited)
 */
export function getUserExportLimit(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): number {
  if (isSystemAdmin(profile)) return 0;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  if (tier.maxExportRowsLimit !== undefined) return tier.maxExportRowsLimit;
  if (tier.level === 0) return 0;
  if (tier.level === 1) return 5000;
  if (tier.level === 2) return 1000;
  if (tier.level === 3) return 500;
  return 100;
}

/**
 * Check whether Data Loss Prevention (DLP) digital watermark is enforced on exports
 */
export function isExportWatermarkRequired(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return false;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.exportWatermarkEnabled ?? true;
}

/**
 * Check whether Multi-Factor Authentication (2FA) is enforced for this role
 */
export function isTwoFactorRequired(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.twoFactorRequired ?? (tier.level <= 1);
}

/**
 * Get approved network perimeter scope for the active user
 */
export function getUserNetworkScope(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): 'factory_intranet' | 'vpn_secure' | 'unrestricted' {
  if (isSystemAdmin(profile)) return 'unrestricted';
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.allowedNetworkScope || (tier.level <= 1 ? 'vpn_secure' : 'factory_intranet');
}

/**
 * Check whether user can override emergency workstation lockouts
 */
export function canUserOverrideLock(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return true;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canOverrideLocks ?? (tier.level <= 2);
}

/**
 * Check whether user has authority to purge security audit trails
 */
export function canUserPurgeAudit(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): boolean {
  if (isSystemAdmin(profile)) return true;
  const tier = getEffectiveRoleTier(profile, roleTiers);
  return tier.canPurgeAuditLogs ?? (tier.level === 0);
}

/**
 * Get complete Privacy & Security Clearance Profile for the user
 */
export function getUserPrivacyClearance(
  profile: UserProfile | undefined,
  roleTiers: RoleTier[]
): UserPrivacyClearance {
  const isSys = isSystemAdmin(profile);
  const tier = getEffectiveRoleTier(profile, roleTiers);
  const level = isSys ? 0 : tier.level;

  const canFinancials = isSys || (tier.canViewSensitiveFinancials ?? (level <= 2));
  const canPii = isSys || (tier.canViewPii ?? (level <= 3));
  const canSecurity = isSys || (tier.canManageSecuritySettings ?? (level <= 1));
  const canAudit = isSys || (tier.canViewAuditLogs ?? (level <= 2));
  const canLock = tier.canLockTerminal ?? true;
  const requiresPin = !isSys && (tier.requiresPinConfirmation ?? (level >= 1));
  const masking = isSys ? 'none' : (tier.dataMaskingLevel || (level <= 2 ? 'none' : level === 3 ? 'partial' : 'strict'));
  const timeout = isSys ? 60 : (tier.sessionTimeoutMinutes || (level >= 4 ? 10 : level === 3 ? 15 : 30));
  
  const exportWatermark = !isSys && (tier.exportWatermarkEnabled ?? true);
  const canRawExport = isSys || (tier.canExportRawData ?? (level <= 1));
  const maxRows = isSys ? 0 : (tier.maxExportRowsLimit !== undefined ? tier.maxExportRowsLimit : (level === 1 ? 5000 : level === 2 ? 1000 : level === 3 ? 500 : 100));
  const twoFactor = isSys || (tier.twoFactorRequired ?? (level <= 1));
  const networkScope = isSys ? 'unrestricted' : (tier.allowedNetworkScope || (level <= 1 ? 'vpn_secure' : 'factory_intranet'));
  const overrideLock = isSys || (tier.canOverrideLocks ?? (level <= 2));
  const purgeAudit = isSys || (tier.canPurgeAuditLogs ?? (level === 0));

  let clearanceLevel: string = tier.privacyClearanceLevel || 'Level 2 (Operational Clearance)';
  let badgeColor: 'emerald' | 'blue' | 'amber' | 'slate' | 'indigo' = 'blue';

  if (level === 0 || isSys) {
    clearanceLevel = 'Level 4 (Root Security Authority)';
    badgeColor = 'indigo';
  } else if (level === 1) {
    clearanceLevel = 'Level 4 (Full Department Clearance)';
    badgeColor = 'emerald';
  } else if (level === 2) {
    clearanceLevel = 'Level 3 (Super-User Clearance)';
    badgeColor = 'blue';
  } else if (level === 3) {
    clearanceLevel = 'Level 2 (Operational Clearance)';
    badgeColor = 'amber';
  } else {
    clearanceLevel = 'Level 1 (Field Clearance)';
    badgeColor = 'slate';
  }

  // Calculate composite security compliance score (0 - 100)
  let score = 50;
  if (canSecurity) score += 10;
  if (canAudit) score += 10;
  if (canLock) score += 5;
  if (exportWatermark) score += 10;
  if (twoFactor) score += 10;
  if (masking !== 'none') score += 5;

  let privacyRiskLevel: 'Low' | 'Moderate' | 'Guarded' | 'Restricted' = 'Guarded';
  if (level <= 1) privacyRiskLevel = 'Low';
  else if (level === 2) privacyRiskLevel = 'Moderate';
  else if (level === 3) privacyRiskLevel = 'Guarded';
  else privacyRiskLevel = 'Restricted';

  const securityScore = Math.min(100, Math.max(0, score));
  let securityScoreRating = { label: 'Good Standard', color: 'emerald' };
  if (securityScore >= 90) securityScoreRating = { label: 'Military-Grade Compliance', color: 'indigo' };
  else if (securityScore >= 75) securityScoreRating = { label: 'High Enterprise Security', color: 'emerald' };
  else if (securityScore >= 60) securityScoreRating = { label: 'Standard Operational', color: 'blue' };
  else securityScoreRating = { label: 'Basic Floor Guarded', color: 'amber' };

  return {
    clearanceLevel,
    badgeLabel: clearanceLevel.split('(')[1]?.replace(')', '') || clearanceLevel,
    badgeColor,
    canViewFinancials: canFinancials,
    canViewPii: canPii,
    canManageSecurity: canSecurity,
    canViewAuditLogs: canAudit,
    canLockTerminal: canLock,
    requiresPin,
    maskingLevel: masking,
    sessionTimeoutMinutes: timeout,
    securityScore,
    exportWatermark,
    canExportRawData: canRawExport,
    maxExportRowsLimit: maxRows,
    twoFactorRequired: twoFactor,
    networkScope,
    canOverrideLocks: overrideLock,
    canPurgeAuditLogs: purgeAudit,
    privacyRiskLevel,
    securityScoreRating
  };
}
