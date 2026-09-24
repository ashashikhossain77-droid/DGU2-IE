/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { initAuth, testConnection } from './lib/firebaseAuth';
import { Sparkles, Bot, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import {
  LineEntry,
  ChecklistMap,
  ChecklistStatus,
  TodoItem,
  ScheduleItem,
  LeanActionItem,
  UserProfile,
  RoleTier,
  DashboardLayout,
  NotificationItem,
  SyncState,
  ThemeType,
  SaveStatus,
  PrivacySecuritySettings,
  SecurityAuditEntry,
  FactoryIndustryProfile
} from './types';
import {
  getStoredActiveFactory,
  setStoredActiveFactory,
  getStoredSavedFactories,
  setStoredSavedFactories
} from './data/factoryProfiles';
import type { SettingsTab } from './components/SettingsModal';
import {
  ALL_IMPORTED_DEBONAIR_LINES,
  DEBONAIR_SEPTEMBER_21_DATE,
  DEBONAIR_AVAILABLE_DATES
} from './data/importedDebonairData';
import {
  INITIAL_TODOS,
  SL_TASK_TODOS,
  INITIAL_SCHEDULES,
  INITIAL_LEAN_ACTIONS,
  INITIAL_NOTIFICATIONS,
  CHECKLIST_TASK_COUNT,
  ROLE_TIERS,
  DEFAULT_USER_PROFILE,
  SYSTEM_ADMIN_PROFILE,
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeChecklistStatuses
} from './mockData';
import { SYSTEM_ADMIN_EMAIL } from './utils/rbac';
import {
  generateDefaultChecklists,
  getTodayDateStr,
  calculateScorecardMetrics,
  calculateStyleWipThreshold
} from './utils';
import { playAuditoryAlert } from './utils/audioAlert';

// Code-split secondary tabs for fast initial boot
const DailyChecklist = lazy(() => import('./components/DailyChecklist').then(m => ({ default: m.DailyChecklist })));
const TodoSchedule = lazy(() => import('./components/TodoSchedule').then(m => ({ default: m.TodoSchedule })));
const LineData = lazy(() => import('./components/LineData').then(m => ({ default: m.LineData })));
const LeanToolkit = lazy(() => import('./components/LeanToolkit').then(m => ({ default: m.LeanToolkit })));
const MonthlySummary = lazy(() => import('./components/MonthlySummary').then(m => ({ default: m.MonthlySummary })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const IESimulator = lazy(() => import('./components/IESimulator').then(m => ({ default: m.IESimulator })));
const FloorPlanLineSetup = lazy(() => import('./components/FloorPlanLineSetup').then(m => ({ default: m.FloorPlanLineSetup })));
const LineProductionHistoryView = lazy(() => import('./components/LineProductionHistoryView').then(m => ({ default: m.LineProductionHistoryView })));
const ActiveOperationalTiers = lazy(() => import('./components/ActiveOperationalTiers').then(m => ({ default: m.ActiveOperationalTiers })));

// Code-split modals loaded strictly on-demand
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const UserModal = lazy(() => import('./components/UserModal').then(m => ({ default: m.UserModal })));
const NotificationsModal = lazy(() => import('./components/NotificationsModal').then(m => ({ default: m.NotificationsModal })));
const DatabaseModal = lazy(() => import('./components/DatabaseModal').then(m => ({ default: m.DatabaseModal })));
const PerformanceScorecardModal = lazy(() => import('./components/PerformanceScorecardModal').then(m => ({ default: m.PerformanceScorecardModal })));
const UserChatHubModal = lazy(() => import('./components/UserChatHubModal').then(m => ({ default: m.UserChatHubModal })));
const PrivacySecurityModal = lazy(() => import('./components/PrivacySecurityModal').then(m => ({ default: m.PrivacySecurityModal })));
const TerminalLockScreen = lazy(() => import('./components/TerminalLockScreen').then(m => ({ default: m.TerminalLockScreen })));
const AndroidPackageModal = lazy(() => import('./components/AndroidPackageModal').then(m => ({ default: m.AndroidPackageModal })));

function TabLoadingSkeleton() {
  return (
    <div className="w-full py-20 flex flex-col items-center justify-center gap-3 animate-pulse">
      <div className="w-11 h-11 rounded-2xl bg-[#176f78]/10 border border-[#176f78]/25 flex items-center justify-center shadow-xs">
        <div className="w-5 h-5 border-2 border-[#176f78] border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-xs font-semibold text-[#527078] tracking-wider uppercase">Loading Workspace Module...</p>
    </div>
  );
}

export default function App() {
  const todayStr = getTodayDateStr();

  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedLineNo, setSelectedLineNo] = useState<string>('18');
  const [selectedChecklistDate, setSelectedChecklistDate] = useState<string>(DEBONAIR_SEPTEMBER_21_DATE);
  const [activeDate, setActiveDate] = useState<string>(DEBONAIR_SEPTEMBER_21_DATE);
  const [activeFloor, setActiveFloor] = useState<string>('all');
  const [activeDataset, setActiveDataset] = useState<string>('debonair_sep21');

  // Save Status Indicator for Header ('idle' | 'saving' | 'saved')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const isInitialLinesMount = React.useRef(true);
  const isInitialChecklistsMount = React.useRef(true);
  const saveTimeoutRef = React.useRef<any>(null);
  const idleTimeoutRef = React.useRef<any>(null);

  const notifySave = React.useCallback(() => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      idleTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2500);
    }, 400);
  }, []);

  // Helper to identify and purge removed legacy unit floors
  const isLegacyUnitFloor = (floor?: string) => {
    if (!floor) return false;
    const f = floor.trim();
    return (
      f === 'Floor 02 / Unit A' ||
      f === 'Floor 01 / Unit B' ||
      f === 'Floor 01 / Unit A' ||
      f === 'Floor 02 / Unit B' ||
      /Floor 0[12]\s*\/\s*Unit\s*[AB]/i.test(f)
    );
  };

  // Core Data States with LocalStorage Persistence
  const [lines, setLines] = useState<LineEntry[]>(() => {
    try {
      const saved = localStorage.getItem('ie_lines_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any legacy dummy baseline sample entries and removed legacy unit floors
          const filtered = parsed.filter(
            (item: any) =>
              !isLegacyUnitFloor(item.floor) &&
              !(
                item.id >= 1 &&
                item.id <= 5 &&
                ['18', '19', '20', '21', '24'].includes(String(item.lineNo))
              )
          );
          // Check which imported dates are present
          const existingDates = new Set(filtered.map((item: any) => item.date));
          const missingImported = ALL_IMPORTED_DEBONAIR_LINES.filter(
            item => !existingDates.has(item.date)
          );
          const finalResult = missingImported.length > 0
            ? [...missingImported, ...filtered]
            : (filtered.length > 0 ? filtered : ALL_IMPORTED_DEBONAIR_LINES);

          // If legacy items were purged or new imported dates added, sync to localStorage
          if (finalResult.length !== parsed.length || missingImported.length > 0) {
            try {
              localStorage.setItem('ie_lines_data', JSON.stringify(finalResult));
            } catch {}
          }
          return finalResult;
        }
      }
      return ALL_IMPORTED_DEBONAIR_LINES;
    } catch {
      return ALL_IMPORTED_DEBONAIR_LINES;
    }
  });

  const [checklists, setChecklists] = useState<ChecklistMap>(() => {
    try {
      const saved = localStorage.getItem('ie_checklists_data');
      return saved ? JSON.parse(saved) : generateDefaultChecklists();
    } catch {
      return generateDefaultChecklists();
    }
  });

  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('ie_todos_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const existingIds = new Set(parsed.map((todo: TodoItem) => todo.id));
          return [
            ...parsed,
            ...SL_TASK_TODOS.filter(todo => !existingIds.has(todo.id))
          ];
        }
      }
      return [...INITIAL_TODOS, ...SL_TASK_TODOS];
    } catch {
      return [...INITIAL_TODOS, ...SL_TASK_TODOS];
    }
  });

  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem('ie_schedules_data');
      return saved ? JSON.parse(saved) : INITIAL_SCHEDULES;
    } catch {
      return INITIAL_SCHEDULES;
    }
  });

  const [leanActions, setLeanActions] = useState<LeanActionItem[]>(() => {
    try {
      const saved = localStorage.getItem('ie_lean_actions');
      return saved ? JSON.parse(saved) : INITIAL_LEAN_ACTIONS;
    } catch {
      return INITIAL_LEAN_ACTIONS;
    }
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('ie_user_profile');
      return saved ? JSON.parse(saved) : DEFAULT_USER_PROFILE;
    } catch {
      return DEFAULT_USER_PROFILE;
    }
  });

  const [theme, setTheme] = useState<ThemeType>(() => {
    try {
      return (localStorage.getItem('ie_theme') as ThemeType) || 'light';
    } catch {
      return 'light';
    }
  });

  const [layout, setLayout] = useState<DashboardLayout>(() => {
    try {
      const saved = localStorage.getItem('ie_dashboard_layout');
      return saved ? JSON.parse(saved) : DEFAULT_DASHBOARD_LAYOUT;
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Auditory Floor Alert Settings (Acoustic alert for high WIP and bottleneck breaches)
  const [auditoryAlertsEnabled, setAuditoryAlertsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ie_auditory_alerts');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const knownActiveBreachesRef = React.useRef<Set<string>>(new Set());
  const isInitialMonitorRunRef = React.useRef<boolean>(true);

  useEffect(() => {
    try {
      localStorage.setItem('ie_auditory_alerts', JSON.stringify(auditoryAlertsEnabled));
    } catch {}
  }, [auditoryAlertsEnabled]);

  // Sync state
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'connected',
    latencyMs: 24,
    lastSyncTime: new Date().toISOString()
  });

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('themes');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalTab, setUserModalTab] = useState<'profile' | 'roles'>('profile');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [databaseInitialTab, setDatabaseInitialTab] = useState<'backup' | 'csv-import'>('backup');
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPrivacySecurityOpen, setIsPrivacySecurityOpen] = useState(false);
  const [isAndroidPackageModalOpen, setIsAndroidPackageModalOpen] = useState(false);
  const [isAuthPageOpen, setIsAuthPageOpen] = useState(false);

  // Enterprise Factory & Industry Profile State
  const [factoryProfile, setFactoryProfile] = useState<FactoryIndustryProfile>(() => getStoredActiveFactory());
  const [savedFactories, setSavedFactories] = useState<FactoryIndustryProfile[]>(() => getStoredSavedFactories());
  const [floorSetupInitialSubView, setFloorSetupInitialSubView] = useState<'floor-plan' | 'line-setup' | 'split-view' | 'factory'>('floor-plan');

  useEffect(() => {
    setStoredActiveFactory(factoryProfile);
  }, [factoryProfile]);

  useEffect(() => {
    setStoredSavedFactories(savedFactories);
  }, [savedFactories]);

  const handleUpdateFactoryProfile = (updated: FactoryIndustryProfile) => {
    setFactoryProfile(updated);
    setSavedFactories(prev => {
      const idx = prev.findIndex(f => f.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  };

  const handleSaveFactoryList = (list: FactoryIndustryProfile[]) => {
    setSavedFactories(list);
  };

  const handleOpenFactorySettings = () => {
    setFloorSetupInitialSubView('factory');
    setCurrentTab('floor-plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Track peak production shift hours (08:00 - 19:00 floor operations)
  const [isPeakHour, setIsPeakHour] = useState<boolean>(() => {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 19;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const hour = new Date().getHours();
      setIsPeakHour(hour >= 8 && hour < 19);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Privacy & Security Controls
  const [privacySettings, setPrivacySettings] = useState<PrivacySecuritySettings>(() => {
    try {
      const saved = localStorage.getItem('ie_privacy_security_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      privacyModeEnabled: false,
      blurSensitiveProductionFigures: false,
      autoLockMinutes: 15,
      pinLockEnabled: true,
      pinCode: '1234',
      isLocked: false,
      dataEncryptionNoticeAcknowledged: true
    };
  });

  const [securityAuditTrail, setSecurityAuditTrail] = useState<SecurityAuditEntry[]>(() => {
    try {
      const saved = localStorage.getItem('ie_security_audit_trail');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'audit-init-1',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'System Boot & Telemetry',
        details: 'IE Operational Cockpit initialized with factory local state encryption.',
        severity: 'info',
        user: 'Lead IE'
      },
      {
        id: 'audit-init-2',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Floor Telemetry Handshake',
        details: 'Debonair Unit-02 line registry verified with zero anomalies.',
        severity: 'info',
        user: 'System'
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('ie_privacy_security_settings', JSON.stringify(privacySettings));
    } catch {}
  }, [privacySettings]);

  useEffect(() => {
    try {
      localStorage.setItem('ie_security_audit_trail', JSON.stringify(securityAuditTrail));
    } catch {}
  }, [securityAuditTrail]);

  // Terminal Lockout Handlers
  const handleLockTerminal = () => {
    setPrivacySettings(prev => ({ ...prev, isLocked: true }));
    setSecurityAuditTrail(prev => [
      {
        id: `audit-lock-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Manual Terminal Lockout',
        details: 'User initiated quick security lockout on shop floor terminal.',
        severity: 'security',
        user: profile.name || 'Lead IE'
      },
      ...prev.slice(0, 49)
    ]);
  };

  const handleUnlockTerminal = (elevateToAdmin?: boolean) => {
    setPrivacySettings(prev => ({ ...prev, isLocked: false }));
    if (elevateToAdmin) {
      setProfile(SYSTEM_ADMIN_PROFILE);
      try {
        localStorage.setItem('ie_user_profile', JSON.stringify(SYSTEM_ADMIN_PROFILE));
      } catch (e) {
        console.warn('Profile persistence error:', e);
      }
      setSecurityAuditTrail(prev => [
        {
          id: `audit-unlock-admin-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: 'Terminal Unlocked (Master Admin Elevation)',
          details: 'Master Passcode verified. Elevated to System Admin (MD Ashikur Rahman).',
          severity: 'security',
          user: SYSTEM_ADMIN_PROFILE.name
        },
        ...prev.slice(0, 49)
      ]);
      return;
    }

    setSecurityAuditTrail(prev => [
      {
        id: `audit-unlock-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Terminal Unlocked',
        details: 'PIN verification successful. Workstation access resumed.',
        severity: 'info',
        user: profile.name || 'Lead IE'
      },
      ...prev.slice(0, 49)
    ]);
  };

  const handleClearCache = () => {
    localStorage.removeItem('ie_dashboard_lines');
    localStorage.removeItem('ie_daily_checklists');
    localStorage.removeItem('ie_floor_todos');
    window.location.reload();
  };

  // Auto-lock inactivity listener
  useEffect(() => {
    if (privacySettings.autoLockMinutes <= 0 || privacySettings.isLocked) return;

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setPrivacySettings(prev => ({ ...prev, isLocked: true }));
        setSecurityAuditTrail(prev => [
          {
            id: `audit-autolock-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: 'Inactivity Auto-Lock',
            details: `Workstation locked after ${privacySettings.autoLockMinutes} minutes of inactivity.`,
            severity: 'security',
            user: profile.name || 'Engineer'
          },
          ...prev.slice(0, 49)
        ]);
      }, privacySettings.autoLockMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [privacySettings.autoLockMinutes, privacySettings.isLocked, profile.name]);

  // Auto-sync authenticated Google user identity with active profile
  useEffect(() => {
    testConnection();
    const unsubscribe = initAuth((authUser) => {
      if (authUser) {
        const isSysAdmin = authUser.email?.toLowerCase().trim() === SYSTEM_ADMIN_EMAIL.toLowerCase();
        setProfile(prev => {
          const updated: UserProfile = {
            ...prev,
            name: isSysAdmin ? SYSTEM_ADMIN_PROFILE.name : (prev.googleUid === authUser.uid && prev.name ? prev.name : (authUser.displayName || prev.name)),
            email: authUser.email || prev.email,
            employeeId: isSysAdmin ? (SYSTEM_ADMIN_PROFILE.employeeId || '12455') : prev.employeeId,
            phoneNumber: isSysAdmin ? (SYSTEM_ADMIN_PROFILE.phoneNumber || '+8801644440971') : prev.phoneNumber,
            photoURL: authUser.photoURL || (isSysAdmin ? SYSTEM_ADMIN_PROFILE.photoURL : prev.photoURL),
            googleUid: authUser.uid,
            role: isSysAdmin ? 'admin' : prev.role,
            tierId: isSysAdmin ? 'tier_0' : prev.tierId,
            jobTitle: isSysAdmin ? 'System Administrator (Root Operations)' : prev.jobTitle,
            assignedUnit: isSysAdmin ? (SYSTEM_ADMIN_PROFILE.assignedUnit || 'Debonair LTD (Unit-02) — Master Administration') : prev.assignedUnit,
            shift: isSysAdmin ? (SYSTEM_ADMIN_PROFILE.shift || '24/7 Root Operations & System Control') : prev.shift,
            assignedWing: isSysAdmin ? 'All' : prev.assignedWing
          };
          try {
            localStorage.setItem('ie_user_profile', JSON.stringify(updated));
          } catch (e) {
            console.warn('Profile cache error:', e);
          }
          return updated;
        });
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // System Role Tiers (editable & persistent across app)
  const [roleTiers, setRoleTiers] = useState<RoleTier[]>(() => {
    try {
      const saved = localStorage.getItem('ie_role_tiers_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      return ROLE_TIERS;
    } catch {
      return ROLE_TIERS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ie_role_tiers_data', JSON.stringify(roleTiers));
    } catch (e) {
      console.error('Failed to persist role tiers:', e);
    }
  }, [roleTiers]);

  const handleUpdateRoleTiers = React.useCallback((updatedTiers: RoleTier[]) => {
    setRoleTiers(updatedTiers);
    notifySave();
  }, [notifySave]);

  const handleOpenUserModal = (tab: 'profile' | 'roles' = 'profile') => {
    setUserModalTab(tab);
    setIsUserModalOpen(true);
  };

  const handleOpenDatabase = (tab: 'backup' | 'csv-import' = 'backup') => {
    setDatabaseInitialTab(tab);
    setIsDatabaseOpen(true);
  };

  // Overall IE Effectiveness Scorecard Result
  const scorecardResult = React.useMemo(() => {
    return calculateScorecardMetrics(lines, checklists, selectedChecklistDate);
  }, [lines, checklists, selectedChecklistDate]);

  // Apply theme to body with smooth transition
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.body.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('ie_theme', theme);
      } catch {}
      const timer = setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [theme]);

  // One-time sanitization to purge removed legacy floors ('Floor 02 / Unit A', 'Floor 01 / Unit B', 'Floor 01 / Unit A')
  useEffect(() => {
    setLines(prev => {
      const hasLegacy = prev.some(l => isLegacyUnitFloor(l.floor));
      if (hasLegacy) {
        const cleaned = prev.filter(l => !isLegacyUnitFloor(l.floor));
        try {
          localStorage.setItem('ie_lines_data', JSON.stringify(cleaned));
        } catch {}
        return cleaned;
      }
      return prev;
    });
  }, []);

  // Persist lines with save indicator notification
  useEffect(() => {
    if (isInitialLinesMount.current) {
      isInitialLinesMount.current = false;
      return;
    }
    notifySave();
    try {
      localStorage.setItem('ie_lines_data', JSON.stringify(lines));
    } catch {}
  }, [lines, notifySave]);

  // Persist checklists with save indicator notification
  useEffect(() => {
    if (isInitialChecklistsMount.current) {
      isInitialChecklistsMount.current = false;
      return;
    }
    notifySave();
    try {
      localStorage.setItem('ie_checklists_data', JSON.stringify(checklists));
    } catch {}
  }, [checklists, notifySave]);

  // Persist todos
  useEffect(() => {
    try {
      localStorage.setItem('ie_todos_data', JSON.stringify(todos));
    } catch {}
  }, [todos]);

  // Persist schedules
  useEffect(() => {
    try {
      localStorage.setItem('ie_schedules_data', JSON.stringify(schedules));
    } catch {}
  }, [schedules]);

  // Persist lean actions
  useEffect(() => {
    try {
      localStorage.setItem('ie_lean_actions', JSON.stringify(leanActions));
    } catch {}
  }, [leanActions]);

  // Persist profile
  useEffect(() => {
    try {
      localStorage.setItem('ie_user_profile', JSON.stringify(profile));
    } catch {}
  }, [profile]);

  // Persist layout
  useEffect(() => {
    try {
      localStorage.setItem('ie_dashboard_layout', JSON.stringify(layout));
    } catch {}
  }, [layout]);

  // Periodic simulated telemetry ping
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncState({
        status: 'connected',
        latencyMs: Math.floor(18 + Math.random() * 16),
        lastSyncTime: new Date().toISOString()
      });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // WIP Level & Bottleneck Monitoring Notification & Auditory Alert Trigger
  // Monitors in-line WIP levels and critical workstation bottlenecks across all lines.
  // Flags alerts in NotificationsModal and triggers auditory alert chimes when enabled.
  useEffect(() => {
    let newlyBreachedType: 'bottleneck' | 'wip' | null = null;
    const currentBreachedSet = new Set<string>();

    setNotifications(prevNotifications => {
      let hasChanges = false;
      const updated = [...prevNotifications];

      lines.forEach(line => {
        // --- 1. Style WIP Buffer Threshold Monitoring ---
        const wipInfo = calculateStyleWipThreshold(line);
        const wipAlertId = `wip-alert-line-${line.lineNo}`;

        if (wipInfo.isBreached) {
          currentBreachedSet.add(wipAlertId);
          if (!knownActiveBreachesRef.current.has(wipAlertId) && !isInitialMonitorRunRef.current) {
            newlyBreachedType = newlyBreachedType || 'wip';
          }

          const existingIdx = updated.findIndex(n => n.id === wipAlertId);
          const alertItem: NotificationItem = {
            id: wipAlertId,
            title: `High WIP Alert: Line ${line.lineNo} (${line.style})`,
            message: `Current In-Line WIP (${line.wip} pcs) exceeds the calculated style buffer threshold of ${wipInfo.threshold} pcs by +${wipInfo.overloadPcs} pcs (Target: ${line.targetProd} pcs @ ${wipInfo.hourlyTarget} pcs/hr, ${wipInfo.bufferHours}h buffer allowance). Bottleneck station '${line.bottleneck?.station || 'Main'}' cycle time is ${line.bottleneck?.cycleTime || 0}s vs ${line.bottleneck?.targetCT || 0}s target. Immediate Kanban line rebalance required.`,
            type: 'alert',
            timestamp: existingIdx !== -1 ? updated[existingIdx].timestamp : new Date().toISOString(),
            read: existingIdx !== -1 ? updated[existingIdx].read : false,
            lineNo: line.lineNo,
            targetRole: 'Line IE / Production Supervisor'
          };

          if (existingIdx === -1) {
            updated.unshift(alertItem);
            hasChanges = true;
          } else {
            if (updated[existingIdx].message !== alertItem.message || updated[existingIdx].title !== alertItem.title) {
              updated[existingIdx] = {
                ...updated[existingIdx],
                title: alertItem.title,
                message: alertItem.message
              };
              hasChanges = true;
            }
          }
        } else {
          // If WIP was resolved / reduced below threshold, auto-resolve active alerts
          const existingIdx = updated.findIndex(n => n.id === wipAlertId);
          if (existingIdx !== -1 && !updated[existingIdx].read && updated[existingIdx].type === 'alert') {
            updated[existingIdx] = {
              ...updated[existingIdx],
              read: true,
              title: `WIP Buffer Normalized: Line ${line.lineNo} (${line.style})`,
              message: `In-line WIP (${line.wip} pcs) is now within the calculated buffer threshold (${wipInfo.threshold} pcs). Production flow stabilized.`,
              type: 'sync'
            };
            hasChanges = true;
          }
        }

        // --- 2. Critical Bottleneck Workstation Monitoring ---
        const isBottleneckBreached = Boolean(
          line.bottleneck && (
            line.bottleneck.status === 'critical' ||
            line.bottleneck.status === 'high' ||
            (line.bottleneck.cycleTime > line.bottleneck.targetCT && line.bottleneck.targetCT > 0)
          )
        );
        const bnAlertId = `bottleneck-alert-line-${line.lineNo}`;

        if (isBottleneckBreached) {
          currentBreachedSet.add(bnAlertId);
          if (!knownActiveBreachesRef.current.has(bnAlertId) && !isInitialMonitorRunRef.current) {
            newlyBreachedType = 'bottleneck'; // Prioritize urgent bottleneck chime if both trigger
          }

          const existingBnIdx = updated.findIndex(n => n.id === bnAlertId);
          const bnAlertItem: NotificationItem = {
            id: bnAlertId,
            title: `Bottleneck Alert: Line ${line.lineNo} (${line.bottleneck.station || 'Critical Station'})`,
            message: `Workstation '${line.bottleneck.station}' cycle time is ${line.bottleneck.cycleTime}s vs ${line.bottleneck.targetCT}s target (Variance: +${Math.max(0, line.bottleneck.cycleTime - line.bottleneck.targetCT)}s). Status: ${line.bottleneck.status.toUpperCase()}. Action: ${line.bottleneck.action || 'Line rebalancing and pitch intervention required'}.`,
            type: 'warning',
            timestamp: existingBnIdx !== -1 ? updated[existingBnIdx].timestamp : new Date().toISOString(),
            read: existingBnIdx !== -1 ? updated[existingBnIdx].read : false,
            lineNo: line.lineNo,
            targetRole: 'Line IE / Bottleneck Specialist'
          };

          if (existingBnIdx === -1) {
            updated.unshift(bnAlertItem);
            hasChanges = true;
          } else {
            if (updated[existingBnIdx].message !== bnAlertItem.message || updated[existingBnIdx].title !== bnAlertItem.title) {
              updated[existingBnIdx] = {
                ...updated[existingBnIdx],
                title: bnAlertItem.title,
                message: bnAlertItem.message
              };
              hasChanges = true;
            }
          }
        } else {
          // If bottleneck was resolved / stabilized, auto-resolve active bottleneck alerts
          const existingBnIdx = updated.findIndex(n => n.id === bnAlertId);
          if (existingBnIdx !== -1 && !updated[existingBnIdx].read && (updated[existingBnIdx].type === 'warning' || updated[existingBnIdx].type === 'alert')) {
            updated[existingBnIdx] = {
              ...updated[existingBnIdx],
              read: true,
              title: `Bottleneck Stabilized: Line ${line.lineNo} (${line.bottleneck?.station || 'Station'})`,
              message: `Station cycle time (${line.bottleneck?.cycleTime || 0}s) is within standard takt target (${line.bottleneck?.targetCT || 0}s). Line flow balanced.`,
              type: 'sync'
            };
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updated : prevNotifications;
    });

    // Fire Auditory Alert if a new high WIP or bottleneck breach occurred and sound is enabled
    if (!isInitialMonitorRunRef.current && newlyBreachedType && auditoryAlertsEnabled) {
      playAuditoryAlert(newlyBreachedType);
    }

    knownActiveBreachesRef.current = currentBreachedSet;
    isInitialMonitorRunRef.current = false;
  }, [lines, auditoryAlertsEnabled]);

  // Today checklist completion calculation
  const todayStatuses = normalizeChecklistStatuses(checklists[todayStr]);
  const todayDone = todayStatuses.filter(s => s === 'yes').length;
  const todayPending = todayStatuses.filter(s => s === 'pending').length;
  const todayNotDone = todayStatuses.filter(s => s === 'no').length;
  const checklistCompletionPct = Math.round((todayDone / CHECKLIST_TASK_COUNT) * 100);

  // Pending todos count
  const pendingTodosCount = todos.filter(t => t.status !== 'completed').length;
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  // Handlers
  const handleUpdateChecklistTask = (date: string, idx: number, status: ChecklistStatus) => {
    const current = normalizeChecklistStatuses(checklists[date]);
    const updated = [...current];
    updated[idx] = status;
    setChecklists(prev => ({ ...prev, [date]: updated }));
  };

  const handleBatchUpdateChecklist = (date: string, statuses: ChecklistStatus[]) => {
    setChecklists(prev => ({ ...prev, [date]: statuses }));
  };

  const handleSaveLine = (updatedLine: LineEntry) => {
    setLines(prev => prev.map(l => (l.id === updatedLine.id ? updatedLine : l)));
  };

  const handleSaveMultipleLines = (updatedLines: LineEntry[]) => {
    const updatedMap = new Map(updatedLines.map(l => [l.id, l]));
    setLines(prev => prev.map(l => (updatedMap.has(l.id) ? updatedMap.get(l.id)! : l)));
  };

  const handleReorderLines = (reorderedFloorLines: LineEntry[]) => {
    const updatedMap = new Map(reorderedFloorLines.map((l, idx) => [l.id, { ...l, floorOrder: idx + 1 }]));
    setLines(prev => prev.map(l => (updatedMap.has(l.id) ? updatedMap.get(l.id)! : l)));
  };

  const handleDeleteLine = (identifier: string | number) => {
    setLines(prev => {
      const filtered = prev.filter(l =>
        typeof identifier === 'string'
          ? l.lineNo !== identifier
          : l.id !== identifier
      );
      const deletedLineNo =
        typeof identifier === 'string'
          ? identifier
          : prev.find(l => l.id === identifier)?.lineNo;
      if (deletedLineNo && deletedLineNo === selectedLineNo && filtered.length > 0) {
        setSelectedLineNo(filtered[0].lineNo);
      }
      return filtered;
    });
  };

  const handleDeleteFloor = (floorName: string, mode: 'delete_all_lines' | 'reassign', targetFloor?: string) => {
    const trimmed = floorName.trim().toLowerCase();
    if (mode === 'delete_all_lines') {
      setLines(prev => {
        const remaining = prev.filter(l => (l.floor?.trim().toLowerCase() || '') !== trimmed);
        const deletedLines = prev.filter(l => (l.floor?.trim().toLowerCase() || '') === trimmed);
        const hadSelected = deletedLines.some(l => l.lineNo === selectedLineNo);
        if (hadSelected && remaining.length > 0) {
          setSelectedLineNo(remaining[0].lineNo);
        }
        return remaining;
      });
    } else if (mode === 'reassign' && targetFloor) {
      const newFloor = targetFloor.trim();
      setLines(prev =>
        prev.map(l =>
          (l.floor?.trim().toLowerCase() || '') === trimmed
            ? { ...l, floor: newFloor }
            : l
        )
      );
    }
  };

  const handleAddNewLine = (customLineOrData?: LineEntry | Partial<LineEntry>) => {
    if (customLineOrData && 'id' in customLineOrData && customLineOrData.id && 'lineNo' in customLineOrData) {
      setLines(prev => [...prev, customLineOrData as LineEntry]);
      setSelectedLineNo((customLineOrData as LineEntry).lineNo);
      return;
    }

    const nextNumericLine = lines.reduce((max, l) => {
      const num = parseInt(l.lineNo.replace(/\D/g, ''), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const newLineNo = customLineOrData?.lineNo || String(nextNumericLine > 0 ? nextNumericLine + 1 : 25);

    const newLine: LineEntry = {
      id: Date.now(),
      date: customLineOrData?.date || activeDate || todayStr,
      lineNo: newLineNo,
      floor: customLineOrData?.floor || 'Padma Floor',
      buyer: customLineOrData?.buyer || 'Target',
      style: customLineOrData?.style || 'BS-100 Basic Tee',
      smv: customLineOrData?.smv || 0.75,
      plannedMP: customLineOrData?.plannedMP || 35,
      workingHours: customLineOrData?.workingHours || 8,
      targetEff: customLineOrData?.targetEff || 85,
      targetProd: customLineOrData?.targetProd || 1200,
      achievedProd: customLineOrData?.achievedProd ?? 1020,
      efficiency: customLineOrData?.efficiency ?? 85,
      remarks: customLineOrData?.remarks || 'Newly commissioned line setup',
      orderQty: customLineOrData?.orderQty || 10000,
      dailyInput: customLineOrData?.dailyInput || 1100,
      dailyOutput: customLineOrData?.dailyOutput || 1020,
      wip: customLineOrData?.wip ?? 200,
      balancingGraph: 'day1',
      nextStyle: customLineOrData?.nextStyle || 'BS-200 V-Neck',
      nextStyleDate: customLineOrData?.nextStyleDate || todayStr,
      mp: customLineOrData?.mp || {
        Operator: { present: 26, absent: 2 },
        Helper: { present: 6, absent: 1 },
        'Iron Man': { present: 2, absent: 0 }
      },
      balanceMethod: customLineOrData?.balanceMethod || 'Overtime',
      balanceNotes: customLineOrData?.balanceNotes || 'New line ramp up',
      top5: customLineOrData?.top5 || {
        held: 'yes',
        attendance: 90,
        items: ['Initial machine inspection', 'Thread tension calibration'],
        notes: 'Shift kickoff meeting completed'
      },
      bottleneck: customLineOrData?.bottleneck || {
        station: 'Neckband attachment',
        cycleTime: 42.0,
        targetCT: 40.0,
        status: 'ok',
        action: 'Guide attachment aligned'
      },
      timeStudy: customLineOrData?.timeStudy || {
        done: 'yes',
        type: 'time',
        observedRate: 120,
        standardRate: 130
      },
      buildUp: customLineOrData?.buildUp || {
        day: '1',
        plannedPct: 60,
        achievedPct: 85,
        operators: 34
      },
      lineIE: customLineOrData?.lineIE || {
        name: profile.name,
        level: profile.role,
        period: 'daily'
      },
      ...customLineOrData
    };

    setLines(prev => [...prev, newLine]);
    setSelectedLineNo(newLineNo);
  };

  const handleApplySimulationToLine = (lineNo: string, updates: Partial<LineEntry>) => {
    setLines(prev =>
      prev.map(line => {
        if (line.lineNo === lineNo) {
          return {
            ...line,
            ...updates,
            mp: updates.mp ? { ...line.mp, ...updates.mp } : line.mp,
            bottleneck: updates.bottleneck ? { ...line.bottleneck, ...updates.bottleneck } : line.bottleneck
          };
        }
        return line;
      })
    );
    setSelectedLineNo(lineNo);
  };

  const handleAddNewLineWithSimulation = (lineData: Partial<LineEntry>) => {
    const newLineNo = lineData.lineNo || String(parseInt(lines[lines.length - 1]?.lineNo || '24') + 1);
    const newLine: LineEntry = {
      id: Date.now(),
      date: todayStr,
      lineNo: newLineNo,
      floor: lineData.floor || 'Padma Floor',
      buyer: lineData.buyer || 'H&M',
      style: lineData.style || 'TS-2401 Crewneck Basic',
      smv: lineData.smv || 12.5,
      plannedMP: lineData.plannedMP || 36,
      workingHours: lineData.workingHours || 8,
      targetEff: lineData.targetEff || 85,
      targetProd: lineData.targetProd || 1200,
      achievedProd: 0,
      efficiency: 0,
      remarks: lineData.remarks || 'Commissioned via IE Simulator',
      orderQty: 15000,
      dailyInput: lineData.targetProd || 1200,
      dailyOutput: 0,
      wip: 120,
      balancingGraph: 'day1',
      nextStyle: '',
      nextStyleDate: '',
      mp: lineData.mp || {
        Operator: { present: 28, absent: 0 },
        Helper: { present: 6, absent: 0 },
        'Iron Man': { present: 2, absent: 0 }
      },
      balanceMethod: 'IE Workstation Balancing',
      balanceNotes: 'Balanced with simulated pitch time',
      top5: {
        held: 'yes',
        attendance: 100,
        items: ['Trial run approved', 'Attachments verified'],
        notes: 'Line setup complete'
      },
      bottleneck: lineData.bottleneck || {
        station: 'Critical Assembly',
        cycleTime: 28,
        targetCT: 26.8,
        status: 'ok',
        action: 'IE plan implemented'
      },
      timeStudy: {
        done: 'yes',
        type: 'time',
        observedRate: 150,
        standardRate: 160
      },
      buildUp: {
        day: '1',
        plannedPct: 55,
        achievedPct: 55,
        operators: lineData.plannedMP || 36
      },
      lineIE: {
        name: profile.name,
        level: 'executive',
        period: 'daily'
      }
    };
    setLines(prev => [...prev, newLine]);
    setSelectedLineNo(newLineNo);
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleRestoreBackup = (data: any) => {
    if (data.lines) setLines(data.lines);
    if (data.checklists) setChecklists(data.checklists);
    if (data.todos) setTodos(data.todos);
    if (data.leanActions) setLeanActions(data.leanActions);
  };

  const handleImportLines = (
    importedLines: LineEntry[],
    mode: 'upsert' | 'append' | 'replace' = 'upsert'
  ) => {
    if (importedLines.length === 0) return;

    setLines(prev => {
      if (mode === 'replace') {
        return importedLines;
      }

      if (mode === 'append') {
        const existingLineNos = new Set(prev.map(l => l.lineNo.trim().toLowerCase()));
        const onlyNew = importedLines.filter(l => !existingLineNos.has(l.lineNo.trim().toLowerCase()));
        return [...prev, ...onlyNew];
      }

      // Default: 'upsert'
      const updated = [...prev];
      const newLinesToAdd: LineEntry[] = [];

      importedLines.forEach(imp => {
        const idx = updated.findIndex(
          l => l.lineNo.trim().toLowerCase() === imp.lineNo.trim().toLowerCase()
        );
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            ...imp,
            id: updated[idx].id // maintain stable ID
          };
        } else {
          newLinesToAdd.push(imp);
        }
      });

      return [...updated, ...newLinesToAdd];
    });

    if (importedLines[0]?.lineNo) {
      setSelectedLineNo(importedLines[0].lineNo);
    }

    setNotifications(prev => [
      {
        id: `notif-csv-${Date.now()}`,
        title: `CSV Import: ${importedLines.length} Line(s) Integrated`,
        message: `Validated and added ${importedLines.length} line configurations into the factory registry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
        type: 'sync',
        lineNo: importedLines[0]?.lineNo
      },
      ...prev
    ]);
  };

  const handleResetFactoryDefaults = () => {
    setLines(ALL_IMPORTED_DEBONAIR_LINES);
    setChecklists(generateDefaultChecklists());
    setTodos(INITIAL_TODOS);
    setSchedules(INITIAL_SCHEDULES);
    setLeanActions(INITIAL_LEAN_ACTIONS);
    localStorage.clear();
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      document.body.setAttribute('data-theme', nextTheme);

      if ('startViewTransition' in document) {
        (document as any).startViewTransition(() => {
          setTheme(nextTheme);
        });
      } else {
        setTheme(nextTheme);
      }

      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 500);
    } else {
      setTheme(nextTheme);
    }
  };

  const handleAddTodoFromAudit = (item: Partial<TodoItem>) => {
    const fullItem: TodoItem = {
      id: item.id || `todo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: item.title || 'Kaizen Task',
      description: item.description || '',
      category: item.category || 'kaizen_ci',
      priority: item.priority || 'medium',
      status: item.status || 'pending',
      targetDate: item.targetDate || todayStr,
      dueTime: item.dueTime || '05:00 PM',
      lineNo: item.lineNo || selectedLineNo,
      assignedToRole: item.assignedToRole || 'Line IE',
      assignedToName: item.assignedToName || profile.name,
      assignedByRole: item.assignedByRole || 'AI IE Diagnostic Agent',
      assignedByName: item.assignedByName || 'IE System',
      subtasks: item.subtasks || [],
      createdAt: new Date().toISOString()
    };
    setTodos(prev => [...prev, fullItem]);
  };

  const handleSelectDate = (date: string) => {
    setActiveDate(date);
    setSelectedChecklistDate(date);
    if (date === '2026-09-21') setActiveDataset('debonair_sep21');
    else if (date === '2026-09-20') setActiveDataset('debonair_sep20');
    else if (date === '2026-09-19') setActiveDataset('debonair_sep19');
    else if (date === '2026-09-17') setActiveDataset('debonair_sep17');
    else setActiveDataset('custom');
  };

  const handleInitializeDateLines = (targetDate: string) => {
    const alreadyHas = lines.some(l => l.date === targetDate);
    if (alreadyHas) return;

    // Use 21-Sep regular dataset as clean operational template
    const regularTemplate = lines.filter(l => l.date === '2026-09-21');
    const source = regularTemplate.length > 0 ? regularTemplate : lines.slice(0, 34);

    const seeded: LineEntry[] = source.map(l => ({
      ...l,
      id: Date.now() + Math.floor(Math.random() * 1000000),
      date: targetDate,
      achievedProd: 0,
      efficiency: 0,
      dailyOutput: 0
    }));

    setLines(prev => [...seeded, ...prev]);
    setActiveDate(targetDate);
    setSelectedChecklistDate(targetDate);
    notifySave();
  };

  const handleSelectDataset = (dataset: string) => {
    setActiveDataset(dataset);
    let targetDate = '2026-09-21';
    if (dataset === 'debonair_sep20') targetDate = '2026-09-20';
    else if (dataset === 'debonair_sep19') targetDate = '2026-09-19';
    else if (dataset === 'debonair_sep17') targetDate = '2026-09-17';
    setActiveDate(targetDate);
    setSelectedChecklistDate(targetDate);
  };

  const handleReloadDebonair = () => {
    const importedDates = new Set(['2026-09-17', '2026-09-19', '2026-09-20', '2026-09-21']);
    const otherLines = lines.filter(
      l => !importedDates.has(l.date) && !isLegacyUnitFloor(l.floor)
    );
    const updated = [...ALL_IMPORTED_DEBONAIR_LINES, ...otherLines];
    setLines(updated);
    try {
      localStorage.setItem('ie_lines_data', JSON.stringify(updated));
    } catch {}
    setActiveDate(DEBONAIR_SEPTEMBER_21_DATE);
    setSelectedChecklistDate(DEBONAIR_SEPTEMBER_21_DATE);
    setActiveDataset('debonair_sep21');
  };

  // Keep the source app's legacy navigation labels working while the artifact
  // shell uses the canonical tab ids exposed by BottomNav.
  const handleNavigate = (tab: string, lineNo?: string) => {
    const tabAliases: Record<string, string> = {
      lines: 'linedata',
      'daily-checklist': 'checklist',
      'ie-simulator': 'simulator',
      history: 'line-history',
      'production-history': 'line-history',
      'line-history': 'line-history',
      'factory-profile': 'floor-plan',
      'factory-setup': 'floor-plan',
      factory: 'floor-plan'
    };

    if (tab === 'factory' || tab === 'factory-setup' || tab === 'factory-profile' || lineNo === 'factory') {
      setFloorSetupInitialSubView('factory');
      setCurrentTab('floor-plan');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (lineNo) setSelectedLineNo(lineNo);
    setCurrentTab(tabAliases[tab] || tab);
  };

  return (
    <div
      data-theme={theme}
      data-privacy-shield={privacySettings.privacyModeEnabled || privacySettings.blurSensitiveProductionFigures}
      className="cockpit-shell min-h-[100dvh] flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased transition-colors duration-300"
    >
      <motion.div
        key={theme}
        initial={{ opacity: 0.85 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 flex flex-col w-full"
      >
        {/* Top Application Header */}
        <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        unreadCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onLogoClick={() => handleNavigate('dashboard')}
        onOpenScorecard={() => setIsScorecardOpen(true)}
        scorecardScore={scorecardResult.overallScore}
        activeDataset={activeDataset}
        onSelectDataset={handleSelectDataset}
        onReloadDebonair={handleReloadDebonair}
        saveStatus={saveStatus}
        activeDate={activeDate}
        onSelectDate={handleSelectDate}
        activeFloor={activeFloor}
        onSelectFloor={setActiveFloor}
        onOpenRoles={() => handleOpenUserModal('roles')}
        onOpenChat={() => setIsChatOpen(true)}
        profile={profile}
        onOpenProfile={() => handleOpenUserModal('profile')}
        onOpenAuth={() => setIsAuthPageOpen(true)}
        onOpenDatabase={handleOpenDatabase}
        lines={lines}
        onInitializeDateLines={handleInitializeDateLines}
        onLockTerminal={handleLockTerminal}
        factoryProfile={factoryProfile}
        onOpenFactorySettings={handleOpenFactorySettings}
        onOpenAndroidPackage={() => setIsAndroidPackageModalOpen(true)}
      />

      {/* Main Content Area: Responsive padding with safe-area spacing for mobile bottom navigation */}
      <main className="flex-1 max-w-[1500px] w-full mx-auto px-2.5 sm:px-6 py-4 sm:py-7 pb-24 md:pb-8">
        <Suspense fallback={<TabLoadingSkeleton />}>
          {currentTab === 'dashboard' && (
            <Dashboard
              lines={lines}
              todayDate={todayStr}
              activeDate={activeDate}
              onSelectDate={handleSelectDate}
              onInitializeDateLines={handleInitializeDateLines}
              layout={layout}
              onNavigate={handleNavigate}
              onSelectLine={setSelectedLineNo}
              selectedLineNo={selectedLineNo}
              onSaveLine={handleSaveLine}
              onChecklistCompleted={() => handleUpdateChecklistTask(activeDate || todayStr, 0, 'yes')}
              checklistCompletion={checklistCompletionPct}
              checklistCounts={{
                done: todayDone,
                pending: todayPending,
                notDone: todayNotDone,
                total: CHECKLIST_TASK_COUNT
              }}
              profile={profile}
              roleTiers={roleTiers}
              onOpenUserModal={() => handleOpenUserModal('profile')}
              onOpenScorecard={() => setIsScorecardOpen(true)}
              onOpenDatabase={handleOpenDatabase}
              checklists={checklists}
              onUpdateChecklistTask={handleUpdateChecklistTask}
              onBatchUpdateChecklist={handleBatchUpdateChecklist}
              onSaveMultipleLines={handleSaveMultipleLines}
              factoryProfile={factoryProfile}
            />
          )}

          {(currentTab === 'roles' || currentTab === 'tiers' || currentTab === 'operational-tiers') && (
            <ActiveOperationalTiers
              currentTierId={profile.tierId || 'tier_1'}
              onSelectTier={(tier) => {
                setProfile(prev => ({
                  ...prev,
                  tierId: tier.id,
                  jobTitle: tier.name
                }));
                notifySave();
              }}
              profile={profile}
              roleTiers={roleTiers}
              onOpenRoleEditor={() => handleOpenUserModal('roles')}
              onSelectLineFilter={(lineNo) => {
                setSelectedLineNo(lineNo);
                setCurrentTab('linedata');
              }}
            />
          )}

          {currentTab === 'checklist' && (
            <DailyChecklist
              checklists={checklists}
              selectedDate={selectedChecklistDate}
              onSelectDate={setSelectedChecklistDate}
              onUpdateTaskStatus={handleUpdateChecklistTask}
              onBatchUpdateChecklist={handleBatchUpdateChecklist}
              profile={profile}
              roleTiers={roleTiers}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'todo-schedule' && (
            <TodoSchedule
              todos={todos}
              schedules={schedules}
              onUpdateTodos={setTodos}
              onUpdateSchedules={setSchedules}
              profile={profile}
            />
          )}

          {currentTab === 'linedata' && (
            <LineData
              lines={lines}
              checklists={checklists}
              selectedLineNo={selectedLineNo}
              onSelectLineNo={setSelectedLineNo}
              onSaveLine={handleSaveLine}
              onAddNewLine={handleAddNewLine}
              onDeleteLine={handleDeleteLine}
              onDeleteFloor={handleDeleteFloor}
              onNavigate={handleNavigate}
              activeDate={activeDate}
              onSelectDate={handleSelectDate}
              profile={profile}
              roleTiers={roleTiers}
            />
          )}

          {(currentTab === 'floor-plan' ||
            currentTab === 'floorplan' ||
            currentTab === 'visual-floor-plan' ||
            currentTab === 'line-management' ||
            currentTab === 'line-configuration' ||
            currentTab === 'factory') && (
            <FloorPlanLineSetup
              lines={lines}
              onSaveLine={handleSaveLine}
              onAddNewLine={handleAddNewLine}
              onDeleteLine={handleDeleteLine}
              onDeleteFloor={handleDeleteFloor}
              onReorderLines={handleReorderLines}
              onNavigate={handleNavigate}
              activeDate={activeDate}
              profile={profile}
              initialSubView={
                currentTab === 'line-management' || currentTab === 'line-configuration'
                  ? 'line-setup'
                  : currentTab === 'factory'
                  ? 'factory'
                  : floorSetupInitialSubView
              }
              initialLineNo={selectedLineNo}
              onOpenDatabase={handleOpenDatabase}
              factoryProfile={factoryProfile}
              onUpdateFactoryProfile={handleUpdateFactoryProfile}
              savedFactories={savedFactories}
              onSaveFactoryList={handleSaveFactoryList}
            />
          )}

          {currentTab === 'simulator' && (
            <IESimulator
              lines={lines}
              selectedLineNo={selectedLineNo}
              onSelectLineNo={setSelectedLineNo}
              onApplyToLine={handleApplySimulationToLine}
              onAddNewLineWithSimulation={handleAddNewLineWithSimulation}
              onNavigate={handleNavigate}
              profile={profile}
            />
          )}

          {currentTab === 'lean-toolkit' && (
            <LeanToolkit
              actions={leanActions}
              onUpdateActions={setLeanActions}
              profile={profile}
              lines={lines}
              onSaveLine={handleSaveLine}
              selectedLineNo={selectedLineNo}
            />
          )}

          {currentTab === 'monthly' && (
            <MonthlySummary
              lines={lines}
              checklists={checklists}
              selectedDate={selectedChecklistDate}
              onSelectDate={setSelectedChecklistDate}
              onNavigate={handleNavigate}
              profile={profile}
              onAddTodo={handleAddTodoFromAudit}
            />
          )}

          {currentTab === 'reports' && (
            <Reports
              lines={lines}
              todayDate={activeDate || todayStr}
              activeDate={activeDate}
              onSelectDate={handleSelectDate}
              activeFloor={activeFloor}
              onSelectFloor={setActiveFloor}
              checklists={checklists}
              profile={profile}
              onNavigate={handleNavigate}
              onDeleteFloor={handleDeleteFloor}
              onImportLines={handleImportLines}
              onOpenDatabase={handleOpenDatabase}
            />
          )}

          {(currentTab === 'line-history' || currentTab === 'history' || currentTab === 'production-history') && (
            <LineProductionHistoryView
              lines={lines}
              selectedLineNo={selectedLineNo}
              onSelectLineNo={setSelectedLineNo}
              onNavigate={handleNavigate}
              onSelectDate={handleSelectDate}
              profile={profile}
            />
          )}
        </Suspense>
      </main>

      {/* Industrial Engineering Footer */}
      <footer className="mt-auto border-t border-[#d9d2c2] bg-[#fbfaf6] py-4 pb-20 md:pb-18 text-xs text-[#527078] cockpit-footer">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#17343a]">IE Daily Control</span>
            <span>•</span>
            <span>Garment Sewing Line Efficiency System</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline font-mono-numbers">Release v2.4.0</span>
          </div>

          <div className="flex items-center gap-4 font-mono-numbers text-[11px] flex-wrap">
            <span>Active Unit: Plant #1 ({profile.assignedUnit})</span>
            <span>•</span>
            <span className="text-[#176f78] font-bold">{profile.shift || 'General Shift (8:00 AM - 5:00 PM)'}</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">Cloud Sync 100% OK</span>
          </div>
        </div>
      </footer>
      </motion.div>

      {/* Fixed Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={handleNavigate}
        checklistProgress={checklistCompletionPct}
        pendingTodosCount={pendingTodosCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenDatabase={() => handleOpenDatabase('backup')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenUserModal={handleOpenUserModal}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenAndroidPackage={() => setIsAndroidPackageModalOpen(true)}
        onOpenAuth={() => setIsAuthPageOpen(true)}
        profile={profile}
      />

      {/* Modals - Lazy-loaded on-demand for lightning fast boot */}
      <Suspense fallback={null}>
        {isAuthPageOpen && (
          <AuthPage
            isOpen={isAuthPageOpen}
            currentProfile={profile}
            roleTiers={roleTiers}
            onSuccess={(updatedProfile) => {
              setProfile(updatedProfile);
              setIsAuthPageOpen(false);
              notifySave();
            }}
            onCancel={() => setIsAuthPageOpen(false)}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            initialTab={settingsInitialTab}
            currentTheme={theme}
            onSelectTheme={setTheme}
            layout={layout}
            onUpdateLayout={setLayout}
            auditoryAlertsEnabled={auditoryAlertsEnabled}
            onToggleAuditoryAlerts={setAuditoryAlertsEnabled}
            onOpenPrivacySecurity={() => setIsPrivacySecurityOpen(true)}
            factoryProfile={factoryProfile}
            onUpdateFactoryProfile={handleUpdateFactoryProfile}
            savedFactories={savedFactories}
            onSaveFactoryList={handleSaveFactoryList}
            onNavigate={handleNavigate}
          />
        )}

        {isUserModalOpen && (
          <UserModal
            isOpen={isUserModalOpen}
            onClose={() => setIsUserModalOpen(false)}
            profile={profile}
            onUpdateProfile={setProfile}
            roleTiers={roleTiers}
            onUpdateRoleTiers={handleUpdateRoleTiers}
            initialTab={userModalTab}
            onLockTerminal={handleLockTerminal}
            onOpenPrivacySecurity={() => setIsPrivacySecurityOpen(true)}
            onOpenAuth={() => setIsAuthPageOpen(true)}
          />
        )}

        {isNotificationsOpen && (
          <NotificationsModal
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            notifications={notifications}
            onMarkAsRead={handleMarkNotificationRead}
            onMarkAllAsRead={handleMarkAllNotificationsRead}
            onClearAll={handleClearNotifications}
            onNavigate={(tab, lineNo) => {
              setIsNotificationsOpen(false);
              handleNavigate(tab, lineNo);
            }}
          />
        )}

        {isDatabaseOpen && (
          <DatabaseModal
            isOpen={isDatabaseOpen}
            onClose={() => setIsDatabaseOpen(false)}
            lines={lines}
            checklists={checklists}
            todos={todos}
            leanActions={leanActions}
            onRestoreData={handleRestoreBackup}
            onResetFactoryData={handleResetFactoryDefaults}
            activeDataset={activeDataset}
            onLoadDebonairData={() => handleSelectDataset('debonair_sep17')}
            onImportLines={handleImportLines}
            activeDate={activeDate || todayStr}
            initialTab={databaseInitialTab}
          />
        )}

        {isScorecardOpen && (
          <PerformanceScorecardModal
            isOpen={isScorecardOpen}
            onClose={() => setIsScorecardOpen(false)}
            lines={lines}
            checklists={checklists}
            selectedDate={selectedChecklistDate}
            onSelectDate={setSelectedChecklistDate}
            onNavigate={handleNavigate}
          />
        )}
      </Suspense>

      {/* Floating WhatsApp Communications & AI Hub Trigger Button */}
      <button
        id="floating-ie-ai-chat-btn"
        onClick={() => setIsChatOpen(true)}
        title={isPeakHour ? "Peak Production Shift • Open IE AI Advisor & Shop Floor Chat" : "Open WhatsApp Shop Floor Communications & IE AI Advisor"}
        aria-label="Open WhatsApp Shop Floor Communications & IE AI Advisor"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-3.5 sm:bottom-22 sm:right-6 z-30 flex items-center justify-center gap-2 sm:gap-2.5 w-12 h-12 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-full sm:rounded-2xl bg-[#008069] hover:bg-[#00705c] text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-emerald-400/30 group animate-subtle-breathe touch-manipulation"
      >
        {/* Subtle breathing aura glow */}
        <span className="absolute -inset-1 rounded-full sm:rounded-2xl bg-emerald-400/25 blur-xs pointer-events-none animate-ai-pulse-aura -z-10" />

        <div className="relative">
          <MessageSquare className="w-5 h-5 text-white fill-white" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#25d366] ring-2 ring-[#008069] animate-ping" />
        </div>
        <div className="hidden sm:flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold leading-tight font-display tracking-wider">WhatsApp</span>
            {isPeakHour && (
              <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-amber-300 text-amber-950 leading-none shadow-2xs">
                Peak
              </span>
            )}
          </div>
          <span className="text-[10px] text-emerald-100 leading-tight">Floor Chat • AI</span>
        </div>
      </button>

      {/* Heavy Subsystems - Lazy Loaded on Demand */}
      <Suspense fallback={null}>
        {/* Integrated Shop Floor User Chat & Gemini AI Hub Modal */}
        {isChatOpen && (
          <UserChatHubModal
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            profile={profile}
            lines={lines}
          />
        )}

        {/* Enterprise Privacy & Security Controls Modal */}
        {isPrivacySecurityOpen && (
          <PrivacySecurityModal
            isOpen={isPrivacySecurityOpen}
            onClose={() => setIsPrivacySecurityOpen(false)}
            settings={privacySettings}
            onUpdateSettings={setPrivacySettings}
            onLockTerminal={handleLockTerminal}
            auditTrail={securityAuditTrail}
            onClearCache={handleClearCache}
            profile={profile}
            roleTiers={roleTiers}
          />
        )}

        {/* Terminal Workstation Lock Screen */}
        {privacySettings.isLocked && (
          <TerminalLockScreen
            isLocked={privacySettings.isLocked}
            onUnlock={handleUnlockTerminal}
            pinCode={privacySettings.pinCode}
            profile={profile}
          />
        )}

        {/* Android Package & Mobile Installation Hub Modal */}
        {isAndroidPackageModalOpen && (
          <AndroidPackageModal
            isOpen={isAndroidPackageModalOpen}
            onClose={() => setIsAndroidPackageModalOpen(false)}
          />
        )}
      </Suspense>

      {/* Real-Time Connectivity Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}
