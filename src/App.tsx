import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
  Utensils,
  BookOpen,
  Wallet,
  Lightbulb,
  Bookmark,
  Check,
  Plus,
  Trash2,
  Share2,
  AlertTriangle,
  Info,
  ShoppingCart,
  Search,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowRight,
  Settings,
  Users,
  Edit3,
  Tag,
  Receipt,
  Car,
  Home,
  PiggyBank,
  FileDown,
  FileUp,
  X,
  Calendar,
  PieChart,
  Mic,
  Award,
  Play,
  Tv,
  CalendarCheck,
  Lock,
  Unlock,
  ExternalLink
} from 'lucide-react';
import {
  COMMON_INGREDIENTS,
  RECIPES,
  DAILY_IDEAS,
  DEFAULT_BUDGET_CATEGORIES,
  BUDGET_PRESETS,
  getDeterministicDailyChallenge,
  Recipe,
  Ingredient,
  DailyIdea,
  BudgetCategoryDef,
  ExpenseRecord
} from './data/seedData';
import {
  ShoppingItem,
  ShoppingTotals,
  TedbeeraBackupData,
  PaydayCountdownResult,
  DonutSegment,
  VoiceRecognitionState,
  parseSafeQuantity,
  parseSafePrice,
  calculateLineTotal,
  calculateShoppingTotals,
  normalizeShoppingItemsList,
  reconcileBudgetAllocations,
  formatWhatsAppShoppingMessage,
  createBackupPayload,
  validateBackupPayload,
  calculateCategoryAnalytics,
  calculatePaydayCountdown,
  getPayCycleRange,
  filterExpensesForPayCycle,
  removeSeedDemoExpenses,
  calculateDonutSegments,
  matchSpokenIngredients,
  calculateUniqueAchievementCount,
  toggleTriedTipId,
  toggleSavedTipId,
  REWARD_PLAN_STORAGE_KEY,
  REMINDER_STORAGE_KEY
} from './data/calculationUtils';
import {
  getRewardedAdService,
  getWebSimulationAdapter,
  OFFICIAL_TEST_REWARDED_AD_UNIT
} from './services/rewardedAdService';
import {
  getLocalNotificationService,
} from './services/localNotificationService';
import {
  WEEKLY_DAYS_SCHEDULE,
  getRecipeById,
  calculateRecipeScaledCost,
  consolidateWeeklyPlanIngredients,
  convertConsolidatedToShoppingItems
} from './data/weeklyMealPlan';
import {
  matchDealsForShoppingItems
} from './data/affiliateDeals';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShoppingTotalsSummary } from './features/shopping/ShoppingTotalsSummary';
// Online recipe discovery is intentionally mounted as its own focused kitchen sub-screen.
// The dedicated online search always attempts remote recipe providers before local fallbacks.
// Heavy feature screens are loaded on demand so the first app screen stays lighter.
const HouseholdHub = React.lazy(() =>
  import('./features/household/HouseholdHub').then(module => ({ default: module.HouseholdHub }))
);
const OnlineRecipeSearch = React.lazy(() =>
  import('./features/recipes/OnlineRecipeSearch').then(module => ({ default: module.OnlineRecipeSearch }))
);
const IngredientRecipeFinder = React.lazy(() =>
  import('./features/recipes/IngredientRecipeFinder').then(module => ({ default: module.IngredientRecipeFinder }))
);
import { householdProfileRepository } from './features/household/householdRepository';
import { financeTransactionsRepository } from './features/finance/financeRepository';
import { isFinanceTransaction, type FinanceTransaction } from './features/finance/financeModels';

import type { ActiveTab, MealTypeFilter } from './app/navigation';


interface MicrophonePermissionPlugin {
  request(): Promise<{ granted: boolean }>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  addListener(
    eventName: 'speechResult',
    listenerFunc: (event: { transcript?: string }) => void
  ): Promise<{ remove(): Promise<void> | void }>;
  addListener(
    eventName: 'speechError',
    listenerFunc: (event: { error?: string }) => void
  ): Promise<{ remove(): Promise<void> | void }>;
}

const microphonePermission = registerPlugin<MicrophonePermissionPlugin>('MicrophonePermission');

interface MealReminderLaunchPlugin {
  consumeLaunchTarget(): Promise<{ target?: string; meal?: string }>;
}
const mealReminderLaunch = registerPlugin<MealReminderLaunchPlugin>('NotificationPermission');

export interface SavedBudgetPlan {
  id: string;
  categoryTitle: string;
  totalAmount: number;
  slices: { name: string; percentage: number; amount: number }[];
  date: string;
}

// ========================================================
// SHARED LAYOUT SPACING & ENVIRONMENT CONSTANTS
// ========================================================
export const IS_DEV = import.meta.env.DEV;

// Layout spacing constants:
// Pinned bottom elements inside phone frame:
// - Bottom Navigation Bar: ~56px
// - Google AdMob Banner Container: ~72px when active (50px banner + 22px header/padding)
// - Required breathing room: 70–90 CSS pixels extra clearance above pinned elements
// Dynamic calculation:
// - Banner visible (loading/loaded): 56px + 72px + 80px breathing room = 208px -> 'pb-52'
// - Banner collapsed (failed/disabled): 56px + 0px + 88px breathing room = 144px -> 'pb-36'
export const getBottomScrollPaddingClass = (adStatus: 'loading' | 'loaded' | 'failed' | 'disabled'): string => {
  return adStatus === 'failed' || adStatus === 'disabled' ? 'pb-36' : 'pb-52';
};

// SVG Fallback renderer for food and tips
function SvgIllustration({
  type,
  className = "w-full h-full"
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case 'egg':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="16" fill="#FEF3C7" />
          <circle cx="50" cy="50" r="32" fill="#FDE68A" stroke="#A68B69" strokeWidth="3" />
          <ellipse cx="44" cy="46" rx="14" ry="12" fill="#A68B69" />
          <ellipse cx="46" cy="44" rx="5" ry="4" fill="#FEF3C7" opacity="0.6" />
          <circle cx="62" cy="58" r="3" fill="#10B981" />
          <circle cx="36" cy="62" r="2.5" fill="#EF4444" />
          <circle cx="56" cy="34" r="2" fill="#10B981" />
        </svg>
      );
    case 'koshary':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="16" fill="#FEE2E2" />
          <path d="M20 56C20 72 34 82 50 82C66 82 80 72 80 56H20Z" fill="#DC2626" />
          <path d="M22 56C22 50 35 44 50 44C65 44 78 50 78 56H22Z" fill="#F87171" />
          <ellipse cx="50" cy="45" rx="24" ry="7" fill="#B45309" />
          <circle cx="45" cy="42" r="2" fill="#FEF3C7" />
          <circle cx="55" cy="44" r="2" fill="#FEF3C7" />
          <circle cx="40" cy="46" r="2" fill="#FEF3C7" />
          <circle cx="52" cy="38" r="3" fill="#D97706" />
        </svg>
      );
    case 'pasta':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="16" fill="#FEF9C3" />
          <rect x="22" y="38" width="56" height="34" rx="8" fill="#A68B69" />
          <path d="M26 44C32 40 40 46 48 42C56 38 64 44 74 40" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
          <path d="M26 52C32 48 40 54 48 50C56 46 64 52 74 48" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
          <path d="M26 60C32 56 40 62 48 58C56 54 64 60 74 56" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'soup':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="16" fill="#FFEDD5" />
          <path d="M24 50C24 68 36 78 50 78C64 78 76 68 76 50H24Z" fill="#F97316" />
          <ellipse cx="50" cy="50" rx="26" ry="7" fill="#FDBA74" />
          <path d="M42 32C40 28 44 24 42 20" stroke="#FB923C" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M50 34C48 30 52 26 50 22" stroke="#FB923C" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M58 32C56 28 60 24 58 20" stroke="#FB923C" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'foul':
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="16" fill="#ECFDF5" />
          <ellipse cx="50" cy="58" rx="34" ry="22" fill="#047857" />
          <ellipse cx="50" cy="54" rx="28" ry="16" fill="#92400E" />
          <circle cx="44" cy="52" r="3" fill="#D97706" />
          <circle cx="56" cy="56" r="3" fill="#D97706" />
          <circle cx="50" cy="48" r="3.5" fill="#A68B69" />
          <circle cx="42" cy="58" r="2.5" fill="#EF4444" />
        </svg>
      );
    case 'potatoes':
    case 'meat':
    case 'salad':
    default:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="16" fill="#E8EBDD" />
          <circle cx="50" cy="50" r="30" fill="#3B82F6" opacity="0.8" />
          <path d="M35 50L45 60L65 40" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function renderCategoryIcon(iconName?: string, className = "w-4 h-4") {
  switch (iconName) {
    case 'utensils':
      return <Utensils className={className} />;
    case 'receipt':
      return <Receipt className={className} />;
    case 'car':
      return <Car className={className} />;
    case 'home':
      return <Home className={className} />;
    case 'piggy':
      return <PiggyBank className={className} />;
    case 'tag':
    default:
      return <Tag className={className} />;
  }
}

export default function App() {
  const isNativeApp = Capacitor.isNativePlatform();

  // Acknowledge the current bundle promptly so Capgo can safely roll back a broken OTA release.
  useEffect(() => {
    if (!isNativeApp) return;
    void CapacitorUpdater.notifyAppReady().catch((error) => {
      console.warn('Tadbeera live-update readiness check failed:', error);
    });
  }, [isNativeApp]);

  // Route taps on native meal reminders to the matching kitchen filter.
  useEffect(() => {
    if (!isNativeApp) return;
    let active = true;
    const applyLaunchTarget = (launch: { target?: string; meal?: string }) => {
      if (!active || launch.target !== 'food') return;
      setKitchenView('main');
      setMealFilter(
        launch.meal === 'breakfast' || launch.meal === 'lunch' || launch.meal === 'dinner'
          ? launch.meal
          : 'all'
      );
      setActiveTab('food');
    };
    const consumeTarget = async () => {
      try {
        applyLaunchTarget(await mealReminderLaunch.consumeLaunchTarget());
      } catch (error) {
        console.warn('Unable to route from Tadbeera meal reminder:', error);
      }
    };
    // Cold starts are consumed from the launch intent; warm starts arrive through
    // a native event because singleTop onNewIntent does not guarantee WebView focus.
    const handleNativeLaunch = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      let launch: { target?: string; meal?: string } | null = null;
      if (typeof detail === 'string') {
        try { launch = JSON.parse(detail) as { target?: string; meal?: string }; } catch { launch = null; }
      } else if (detail && typeof detail === 'object') {
        launch = detail as { target?: string; meal?: string };
      }
      if (launch) applyLaunchTarget(launch);
    };
    void consumeTarget();
    const handleResume = () => { void consumeTarget(); };
    window.addEventListener('tadbeeraMealReminderLaunch', handleNativeLaunch);
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    return () => {
      active = false;
      window.removeEventListener('tadbeeraMealReminderLaunch', handleNativeLaunch);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [isNativeApp]);

  // Direct full-screen app state (all 5 core tabs live in App)
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // Food State
  const [mealFilter, setMealFilter] = useState<MealTypeFilter>('all');
  const [familySize, setFamilySize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_family_size');
      const parsed = stored ? parseInt(stored, 10) : 4;
      return isNaN(parsed) || parsed < 1 ? 4 : parsed;
    } catch {
      return 4;
    }
  });
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_custom_pantry');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          return parsed;
        }
      }
    } catch {}
    return ['بيض', 'طماطم', 'بصل'];
  });
  const [isVeryBudgetFilter, setIsVeryBudgetFilter] = useState(false);
  const [isQuickFilter, setIsQuickFilter] = useState(false);
  const [usesLeftoversFilter, setUsesLeftoversFilter] = useState(false);
  const [isZeroMissingOnly, setIsZeroMissingOnly] = useState(false);
  const [isSavedRecipesFilter, setIsSavedRecipesFilter] = useState(false);
  const [selectedRecipeModal, setSelectedRecipeModal] = useState<Recipe | null>(null);
  const [kitchenView, setKitchenView] = useState<'main' | 'offline' | 'online'>('main');
  const [offlineRecipeQuery, setOfflineRecipeQuery] = useState('');

  // Budget & Expense State
  const [budgetAmount, setBudgetAmount] = useState<string>(() => {
    try {
      return localStorage.getItem('tedbeera_budget_amount') || '2500';
    } catch {
      return '2500';
    }
  });

  const [categories, setCategories] = useState<BudgetCategoryDef[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return DEFAULT_BUDGET_CATEGORIES;
    } catch {
      return DEFAULT_BUDGET_CATEGORIES;
    }
  });

  const [categoryPercentages, setCategoryPercentages] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_percentages');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0 && arr.every(n => typeof n === 'number' && !isNaN(n))) {
          // Verify exact 100% invariant
          const sum = arr.reduce((a, b) => a + b, 0);
          if (sum === 100) return arr;
        }
      }
      return DEFAULT_BUDGET_CATEGORIES.map(c => c.defaultPct);
    } catch {
      return DEFAULT_BUDGET_CATEGORIES.map(c => c.defaultPct);
    }
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const mapHouseholdCategory = (categoryId: string): string => {
      if (categoryId === 'طعام') return 'food';
      if (categoryId === 'فواتير') return 'bills';
      if (categoryId === 'مواصلات') return 'transport';
      return 'household';
    };

    try {
      const stored = localStorage.getItem('tedbeera_expenses');
      let baseExpenses: ExpenseRecord[] = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalizedExpenses = parsed.filter(e => e && typeof e === 'object').map(e => ({
            id: String(e.id || Math.random().toString(36).substring(2, 8)),
            categoryId: String(e.categoryId || 'food'),
            amount: parseSafePrice(e.amount) || 0,
            date: String(e.date || new Date().toISOString().split('T')[0]),
            description: String(e.description || 'مصروف عام')
          }));
          baseExpenses = removeSeedDemoExpenses(normalizedExpenses);
        }
      }

      if (localStorage.getItem('tedbeera_finance_migrated_v1') !== 'true') {
        const legacyTxns = financeTransactionsRepository.read();
        const existingIds = new Set(baseExpenses.map(e => e.id));
        const migratedExpenses: ExpenseRecord[] = legacyTxns
          .filter(t => t.type === 'expense' && t.amount > 0)
          .map(t => ({
            id: `hh_${t.id}`,
            categoryId: mapHouseholdCategory(t.categoryId),
            amount: t.amount,
            date: t.date,
            description: t.description || t.categoryId || 'مصروف منزلي'
          }))
          .filter(e => !existingIds.has(e.id));

        if (migratedExpenses.length > 0) {
          baseExpenses = [...migratedExpenses, ...baseExpenses];
        }
        try {
          localStorage.setItem('tedbeera_finance_migrated_v1', 'true');
        } catch {}
      }

      return baseExpenses;
    } catch {
      return [];
    }
  });

  const [extraIncomeRecords, setExtraIncomeRecords] = useState<FinanceTransaction[]>(() => {
    try {
      return financeTransactionsRepository.read().filter(t => t.type === 'income');
    } catch {
      return [];
    }
  });

  // Daily State
  const [todayDateKey, setTodayDateKey] = useState<string>('');
  const [dailyCompleted, setDailyCompleted] = useState<boolean>(false);
  const [dailySearch, setDailySearch] = useState<string>('');
  const [selectedDailyCategory, setSelectedDailyCategory] = useState<string>('الكل');

  // Persistent Saved Content (LocalStorage)
  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_saved_recipes');
      return stored ? JSON.parse(stored) : ['rec_shakshouka'];
    } catch {
      return ['rec_shakshouka'];
    }
  });

  // Phase 4C: Saved Tips (Dedicated Key: tedbeera_phase4c_saved_tips with backward compat)
  const [savedTipIds, setSavedTipIds] = useState<string[]>(() => {
    try {
      const storedPhase4C = localStorage.getItem('tedbeera_phase4c_saved_tips');
      if (storedPhase4C) return JSON.parse(storedPhase4C);
      const storedLegacy = localStorage.getItem('tedbeera_saved_tips');
      return storedLegacy ? JSON.parse(storedLegacy) : ['idea_1', 'idea_2'];
    } catch {
      return ['idea_1', 'idea_2'];
    }
  });

  // Phase 4C: Tried Tips Achievements (Unique Key: tedbeera_phase4c_tried_tips)
  const [triedTipIds, setTriedTipIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_phase4c_tried_tips');
      return stored ? JSON.parse(stored) : ['idea_1'];
    } catch {
      return ['idea_1'];
    }
  });

  // Phase 4C: Daily Tips View Mode ('all' or 'saved' - أفكاري المحفوظة)
  const [dailyTipsViewMode, setDailyTipsViewMode] = useState<'all' | 'saved'>('all');

  // Phase 4C: Egyptian Arabic Voice Recognition State
  const isVoiceSupported = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );
  const [voiceState, setVoiceState] = useState<VoiceRecognitionState>('idle');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const nativeSpeechListenersRef = useRef<any[]>([]);

  const [savedBudgets, setSavedBudgets] = useState<SavedBudgetPlan[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_saved_budgets');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Shopping Items with Safe Migration & NaN Prevention
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_shopping_items');
      if (stored) {
        const raw = JSON.parse(stored);
        const normalized = normalizeShoppingItemsList(raw);
        if (normalized.length > 0) return normalized;
      }
      return [
        { id: '1', name: 'عدس أصفر', quantity: 1, unit: 'كوب', unitPrice: 25, isChecked: false },
        { id: '2', name: 'طماطم مسبكة', quantity: 4, unit: 'حبة', unitPrice: 5, isChecked: true },
        { id: '3', name: 'عيش بلدي سخن', quantity: 10, unit: 'رغيف', unitPrice: null, isChecked: false } // Sample unpriced item
      ];
    } catch {
      return [
        { id: '1', name: 'عدس أصفر', quantity: 1, unit: 'كوب', unitPrice: 25, isChecked: false },
        { id: '2', name: 'طماطم مسبكة', quantity: 4, unit: 'حبة', unitPrice: 5, isChecked: true }
      ];
    }
  });

  // Phase 5 PRO: Custom Recipes State & Persistence
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_custom_recipes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isAddCustomRecipeModalOpen, setIsAddCustomRecipeModalOpen] = useState(false);
  const [customRecipeName, setCustomRecipeName] = useState('');
  const [customRecipeMealType, setCustomRecipeMealType] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch');
  const [customRecipePrepTime, setCustomRecipePrepTime] = useState('20');
  const [customRecipeCost, setCustomRecipeCost] = useState('60');
  const [customRecipeIngredientName, setCustomRecipeIngredientName] = useState('طماطم');

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_custom_recipes', JSON.stringify(customRecipes));
    } catch {}
  }, [customRecipes]);

  const handleSaveCustomRecipe = () => {
    if (!customRecipeName.trim()) {
      showToast('يرجى إدخال اسم الوجبة الخاصة');
      return;
    }
    const costNum = parseFloat(customRecipeCost);
    if (isNaN(costNum) || costNum < 0) {
      showToast('يرجى إدخال تكلفة صحيحة');
      return;
    }
    const prepNum = parseInt(customRecipePrepTime, 10);
    if (isNaN(prepNum) || prepNum <= 0) {
      showToast('يرجى إدخال وقت تحضير صحيح');
      return;
    }

    const newRecipe: Recipe = {
      id: 'custom_' + Math.random().toString(36).substring(2, 9),
      name: customRecipeName.trim(),
      mealType: customRecipeMealType,
      prepTimeMinutes: prepNum,
      estimatedCostEgp: costNum,
      baseServings: 4,
      isVeryBudget: costNum <= 50,
      isQuick: prepNum <= 20,
      usesLeftovers: false,
      svgFallbackIcon: 'koshary',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
      ingredients: [
        {
          name: customRecipeIngredientName.trim() || 'مكون أساسي',
          quantity: '1 وحدة',
          baseAmount: 1,
          unit: 'وحدة'
        }
      ],
      budgetCategory: 'طعام وتموين',
      tags: ['وجبة مخصصة'],
      steps: [
        'جهزي المكونات ونظفيها جيداً.',
        'قومي بالطهي بالطريقة المعتادة حتى تمام النضج.',
        'قدميه ساخناً لأفراد الأسرة وبالهناء والشفاء.'
      ]
    };

    setCustomRecipes(prev => [newRecipe, ...prev]);
    setCustomRecipeName('');
    setIsAddCustomRecipeModalOpen(false);
    showToast('تمت إضافة أكلتك الخاصة بنجاح وحفظها في المحفوظات 🍳');
  };

  const allRecipes = useMemo(() => {
    return [...RECIPES, ...customRecipes];
  }, [customRecipes]);

  // UI Modals & Forms
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('حبة');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState(''); // Empty by default to support unpriced items explicitly

  // Edit Item Price Modal
  const [editingPriceItem, setEditingPriceItem] = useState<{ id: string; name: string; currentPrice: string } | null>(null);

  // Expense Modal
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('food');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Custom Category Modal
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatTip, setNewCatTip] = useState('');

  // Settings & Safety Modals
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [householdName, setHouseholdName] = useState(() => householdProfileRepository.read().name);
  const [householdGovernorate, setHouseholdGovernorate] = useState(() => householdProfileRepository.read().governorate);
  const [householdCity, setHouseholdCity] = useState(() => householdProfileRepository.read().city);

  const [isClearShoppingConfirmOpen, setIsClearShoppingConfirmOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isRestoreConfirmModalOpen, setIsRestoreConfirmModalOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<TedbeeraBackupData | null>(null);

  // Phase 4B: Monthly Payday Configuration (New LocalStorage Key: tedbeera_payday_day)
  const [paydayDay, setPaydayDay] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('tedbeera_payday_day');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isPaydayModalOpen, setIsPaydayModalOpen] = useState(false);
  const [tempPaydayInput, setTempPaydayInput] = useState<string>('25');

  // Phase 4B: Visual Spending Donut Segment Selection State
  const [selectedDonutSegmentId, setSelectedDonutSegmentId] = useState<string | null>(null);
  const [showAllExpenseHistory, setShowAllExpenseHistory] = useState(false);

  // AdMob State & Policy Compliance Controls (Google Mobile Ads)
  type AdStatus = 'loaded' | 'loading' | 'failed' | 'disabled';
  const [adStatus, setAdStatus] = useState<AdStatus>('disabled');
  const [isInterstitialEnabled, setIsInterstitialEnabled] = useState<boolean>(false); // Strictly disabled by default
  const [sessionInterstitialCount, setSessionInterstitialCount] = useState<number>(0);
  const [lastInterstitialTime, setLastInterstitialTime] = useState<number>(0);
  const [isInterstitialActive, setIsInterstitialActive] = useState<boolean>(false);
  const [interstitialCountdown, setInterstitialCountdown] = useState<number>(5);
  const [isAdControlsOpen, setIsAdControlsOpen] = useState<boolean>(false);

  // Interstitial Countdown Timer
  useEffect(() => {
    let timer: any;
    if (isInterstitialActive && interstitialCountdown > 0) {
      timer = setTimeout(() => {
        setInterstitialCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [isInterstitialActive, interstitialCountdown]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 4D: Weekly Meal Plan Unlocked state (Key: tedbeera_phase4d_weekly_plan_unlocked)
  const [isWeeklyPlanUnlocked, setIsWeeklyPlanUnlocked] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(REWARD_PLAN_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Phase 4D: Selected Day in Meal Plan
  const [selectedPlanDayId, setSelectedPlanDayId] = useState<string>('sat');
  const [isConsolidatedShoppingModalOpen, setIsConsolidatedShoppingModalOpen] = useState<boolean>(false);

  // Phase 4D: Rewarded Ad Simulation Modal State
  const [isRewardSimulationOpen, setIsRewardSimulationOpen] = useState<boolean>(false);
  const [isSimulatingPlayback, setIsSimulatingPlayback] = useState<boolean>(false);
  const [playbackCountdown, setPlaybackCountdown] = useState<number>(5);
  const [isAdSessionActive, setIsAdSessionActive] = useState<boolean>(false);

  // Retained for backup compatibility; notification controls live only in Android Settings.
  const [isDailyReminderEnabled, setIsDailyReminderEnabled] = useState<boolean>(() => {
    try { return getLocalNotificationService().getStoredConfig().enabled; } catch { return false; }
  });
  const [reminderTime, setReminderTime] = useState<string>(() => {
    try {
      const config = getLocalNotificationService().getStoredConfig();
      return `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;
    } catch { return '08:00'; }
  });

  // Ask for notification permission once on the first native app launch.
  // After permission is granted, automatically schedule breakfast, lunch and dinner.
  useEffect(() => {
    if (!isNativeApp) return;
    let cancelled = false;
    let initializing = false;
    const initializeMealReminders = async () => {
      if (initializing || cancelled) return;
      initializing = true;
      try {
        const service = getLocalNotificationService();
        const config = service.getStoredConfig();
        let permission = await service.checkPermission();
        const permissionWasPreviouslyDenied = permission === 'denied';

        // Android shows its notification permission dialog only while the permission
        // is in the prompt state. Never request microphone permission during startup.
        if (permission === 'prompt') {
          permission = await service.requestPermission() ? 'granted' : 'denied';
        }
        if (cancelled) return;

        // If the user previously denied notifications (or disabled them in Android
        // Settings), take them to the phone's app-notification settings once per session.
        if (permission === 'unsupported') {
          showToast('تعذر الاتصال بخدمة أذونات أندرويد. حدّث التطبيق إلى أحدث نسخة ثم حاول مرة أخرى.');
          return;
        }

        if (permissionWasPreviouslyDenied && permission !== 'granted') {
          showToast('إذن الإشعارات مرفوض. هنفتح إعدادات تدبيرة علشان تسمح بالتنبيهات.');
          await service.openNotificationSettings();
          return;
        }

        if (permission !== 'granted') {
          showToast('علشان توصلك مواعيد الفطار والغداء والعشاء، اسمح لتدبيرة بإرسال الإشعارات.');
          return;
        }

        // Permission is granted: restore all three alarms and report failures visibly.
        const result = await service.scheduleDailyReminder(config.hour, config.minute);
        if (cancelled) return;
        setIsDailyReminderEnabled(result.success);
        if (!result.success) {
          console.warn('Tadbeera meal reminder scheduling failed:', result.message);
          showToast(result.message);
        } else {
          // Send one immediate test notification after first successful setup so
          // users do not have to wait until the next meal to discover delivery issues.
          const testKey = 'tedbeera_notification_test_sent_v1';
          let testAlreadySent = false;
          try { testAlreadySent = localStorage.getItem(testKey) === 'true'; } catch {}
          if (!testAlreadySent) {
            const testResult = await service.sendTestNotification();
            if (cancelled) return;
            if (testResult.success) {
              try { localStorage.setItem(testKey, 'true'); } catch {}
              showToast('تم ضبط مواعيد الوجبات. هيظهر إشعار اختبار خلال ثوانٍ للتأكد من وصول التنبيهات.');
            } else {
              showToast(testResult.message);
            }
          }
        }
      } finally {
        initializing = false;
      }
    };
    const retryWhenAppResumes = () => {
      if (document.visibilityState === 'visible') {
        void initializeMealReminders().catch(error =>
          console.warn('Tadbeera reminder resume check failed:', error)
        );
      }
    };
    void initializeMealReminders().catch(error => console.warn('Tadbeera reminder initialization failed:', error));
    // Exact-alarm permission is granted in Android Settings. Retry after the user
    // returns so all three reminders are scheduled without an in-app toggle.
    window.addEventListener('focus', retryWhenAppResumes);
    document.addEventListener('visibilitychange', retryWhenAppResumes);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', retryWhenAppResumes);
      document.removeEventListener('visibilitychange', retryWhenAppResumes);
    };
  }, [isNativeApp]);

  // Phase 4D: Rewarded Ad Simulation Playback Timer
  useEffect(() => {
    let timer: any;
    if (isSimulatingPlayback && playbackCountdown > 0) {
      timer = setTimeout(() => {
        setPlaybackCountdown(prev => prev - 1);
      }, 1000);
    } else if (isSimulatingPlayback && playbackCountdown === 0) {
      // Completed simulation!
      const simAdapter = getWebSimulationAdapter();
      simAdapter?.completeSimulation();
      grantWeeklyPlanReward();
    }
    return () => clearTimeout(timer);
  }, [isSimulatingPlayback, playbackCountdown]);

  // Phase 4D: Single, Idempotent Reward Granting Function
  const grantWeeklyPlanReward = () => {
    setIsWeeklyPlanUnlocked(true);
    try {
      localStorage.setItem(REWARD_PLAN_STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('LocalStorage unavailable for reward persistence:', e);
    }
    setIsRewardSimulationOpen(false);
    setIsSimulatingPlayback(false);
    setIsAdSessionActive(false);
    showToast('مبروك! تم فتح جدول وجبات الأسبوع التوفيرية الكاملة بنجاح 🎉');
  };

  // Phase 4D: Dismiss / Cancel Simulation without reward
  const handleCancelRewardSimulation = () => {
    const simAdapter = getWebSimulationAdapter();
    simAdapter?.cancelSimulation();
    setIsRewardSimulationOpen(false);
    setIsSimulatingPlayback(false);
    setIsAdSessionActive(false);
    showToast('تم إلغاء المحاكاة - لم يتم فتح الخطة (بدون مكافأة)');
  };

  // Phase 4D: Request Rewarded Ad (Triggers native or web simulation)
  const handleRequestRewardedAd = () => {
    if (isAdSessionActive) return; // Prevent overlapping ad sessions
    setIsAdSessionActive(true);

    const rewardedService = getRewardedAdService();
    if (rewardedService.isNative()) {
      rewardedService.show({
        onUserEarnedReward: () => {
          grantWeeklyPlanReward();
        },
        onDismissedWithoutReward: () => {
          setIsAdSessionActive(false);
          showToast('تم إغلاق الإعلان قبل اكتماله - لم يتم فتح الخطة');
        },
        onError: (err) => {
          setIsAdSessionActive(false);
          showToast(err || 'تعذر تشغيل الإعلان');
        }
      });
    } else {
      // In Web preview, show custom simulation dialog
      rewardedService.show({
        onUserEarnedReward: () => {
          grantWeeklyPlanReward();
        },
        onDismissedWithoutReward: () => {
          setIsAdSessionActive(false);
        },
        onError: (err) => {
          setIsAdSessionActive(false);
          showToast(err);
        }
      });
      setIsRewardSimulationOpen(true);
      setIsSimulatingPlayback(false);
      setPlaybackCountdown(5);
    }
  };

  const handleStartSimulationPlayback = () => {
    setIsSimulatingPlayback(true);
    setPlaybackCountdown(5);
  };

  // Phase 4D: Add Consolidated Meal Plan Ingredients to Shopping List
  const handleAddConsolidatedPlanToShopping = () => {
    const consolidated = consolidateWeeklyPlanIngredients(familySize);
    const newItems = convertConsolidatedToShoppingItems(consolidated);

    setShoppingItems(prev => {
      const currentList = [...prev];
      newItems.forEach(newItem => {
        const existingIndex = currentList.findIndex(
          item =>
            item.name.trim().toLocaleLowerCase() === newItem.name.trim().toLocaleLowerCase() &&
            item.unit.trim().toLocaleLowerCase() === newItem.unit.trim().toLocaleLowerCase()
        );
        if (existingIndex >= 0) {
          currentList[existingIndex] = {
            ...currentList[existingIndex],
            quantity: Math.round((currentList[existingIndex].quantity + newItem.quantity) * 10) / 10
          };
        } else {
          currentList.push(newItem);
        }
      });
      return currentList;
    });

    setIsConsolidatedShoppingModalOpen(false);
    showToast(`تمت إضافة ${newItems.length} صنف من خطة الأسبوع إلى قائمة المشتريات بنجاح 🛒`);
  };

  // Trigger Interstitial Ad with strict Google AdMob policy validation
  const triggerTestInterstitial = () => {
    // 1. Policy check: must be explicitly enabled
    if (!isInterstitialEnabled) {
      showToast('الإعلانات البينية معطلة حالياً لحماية تجربة المستخدم (سياسة أد موب) 🛡️');
      return;
    }
    // 2. Frequency capping: max 2 per session
    if (sessionInterstitialCount >= 2) {
      showToast('تم الوصول للحد الأقصى للإعلانات البينية في هذه الجلسة (2/2) ⚠️');
      return;
    }
    // 3. Cooldown check: 120 seconds between impressions
    const now = Date.now();
    if (now - lastInterstitialTime < 120000) {
      const remainingSec = Math.ceil((120000 - (now - lastInterstitialTime)) / 1000);
      showToast(`فترة الانتظار نشطة: متبقي ${remainingSec} ثانية قبل الإعلان التالي ⏱️`);
      return;
    }
    // 4. Task interruption guard: never interrupt active budgeting or editing
    if (isAddItemModalOpen || editingPriceItem || isAddExpenseModalOpen || isAddCategoryModalOpen || selectedRecipeModal) {
      showToast('تم حجب الإعلان: لا يمكن إظهار إعلانات أثناء أداء مهمة نشطة 🚫');
      return;
    }

    setIsInterstitialActive(true);
    setInterstitialCountdown(5);
  };

  const handleDismissInterstitial = () => {
    setIsInterstitialActive(false);
    setSessionInterstitialCount(prev => prev + 1);
    setLastInterstitialTime(Date.now());
    showToast('تم إغلاق الإعلان البيني بنجاح واستئناف التطبيق ✓');
  };

  // Fallback image error handling
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const handleImageError = (id: string) => {
    setBrokenImages(prev => ({ ...prev, [id]: true }));
  };

  // Sync selected pantry ingredients safely
  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_custom_pantry', JSON.stringify(selectedIngredients));
    } catch {}
  }, [selectedIngredients]);

  // Sync family size safely
  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_family_size', familySize.toString());
    } catch {}
  }, [familySize]);

  // Sync to LocalStorage with error resilience
  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_saved_recipes', JSON.stringify(savedRecipeIds));
    } catch {}
  }, [savedRecipeIds]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_phase4c_saved_tips', JSON.stringify(savedTipIds));
      localStorage.setItem('tedbeera_saved_tips', JSON.stringify(savedTipIds));
    } catch {}
  }, [savedTipIds]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_phase4c_tried_tips', JSON.stringify(triedTipIds));
    } catch {}
  }, [triedTipIds]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_saved_budgets', JSON.stringify(savedBudgets));
    } catch {}
  }, [savedBudgets]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_shopping_items', JSON.stringify(shoppingItems));
    } catch {}
  }, [shoppingItems]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_budget_amount', budgetAmount);
    } catch {}
  }, [budgetAmount]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_categories', JSON.stringify(categories));
    } catch {}
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_percentages', JSON.stringify(categoryPercentages));
    } catch {}
  }, [categoryPercentages]);

  useEffect(() => {
    try {
      localStorage.setItem('tedbeera_expenses', JSON.stringify(expenses));
    } catch {}
  }, [expenses]);

  // Sync Payday Day safely to LocalStorage
  useEffect(() => {
    try {
      if (paydayDay !== null && paydayDay >= 1 && paydayDay <= 31) {
        localStorage.setItem('tedbeera_payday_day', paydayDay.toString());
      } else {
        localStorage.removeItem('tedbeera_payday_day');
      }
    } catch {}
  }, [paydayDay]);

  // Today's date & daily challenge init
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setTodayDateKey(today);

    try {
      const completedMap = JSON.parse(localStorage.getItem('tedbeera_daily_completed') || '{}');
      setDailyCompleted(!!completedMap[today]);
    } catch {
      setDailyCompleted(false);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Safe Scaled Recipe Cost Calculator (Guaranteed non-NaN)
  const getScaledCost = (recipe: Recipe): number => {
    const baseServings = Math.max(1, recipe.baseServings || 4);
    const validFamilySize = Math.max(1, familySize || 4);
    const cost = ((recipe.estimatedCostEgp || 0) / baseServings) * validFamilySize;
    return Math.round(isNaN(cost) || !isFinite(cost) ? 0 : cost);
  };

  // Safe Scaled Ingredient Quantity Formatter
  const getScaledIngredient = (ing: Ingredient, baseServings: number) => {
    const validServings = Math.max(1, baseServings || 4);
    const validFamilySize = Math.max(1, familySize || 4);
    const baseAmt = Math.max(0.1, ing.baseAmount || 1);
    const scaledAmount = (baseAmt / validServings) * validFamilySize;
    const rounded = Math.round(scaledAmount * 10) / 10;
    return {
      amount: rounded,
      text: `${rounded.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ${ing.unit || 'حبة'}`
    };
  };

  // Matched Recipes with Scaling & Filtering
  const matchedRecipes = useMemo(() => {
    return allRecipes.filter(recipe => {
      if (mealFilter !== 'all' && recipe.mealType !== mealFilter) return false;
      if (isVeryBudgetFilter && !recipe.isVeryBudget) return false;
      if (isQuickFilter && !recipe.isQuick) return false;
      if (usesLeftoversFilter && !recipe.usesLeftovers) return false;
      if (isSavedRecipesFilter && !savedRecipeIds.includes(recipe.id)) return false;
      return true;
    }).map(recipe => {
      const available = recipe.ingredients.filter(ing =>
        selectedIngredients.some(sel => ing.name.includes(sel) || sel.includes(ing.name))
      );
      const missing = recipe.ingredients.filter(ing =>
        !selectedIngredients.some(sel => ing.name.includes(sel) || sel.includes(ing.name))
      );
      return {
        recipe,
        scaledCost: getScaledCost(recipe),
        availableCount: available.length,
        totalCount: recipe.ingredients.length,
        missing,
        isCompleteMatch: missing.length === 0
      };
    }).filter(item => {
      if (isZeroMissingOnly && !item.isCompleteMatch) return false;
      return true;
    }).sort((a, b) => {
      if (a.isCompleteMatch && !b.isCompleteMatch) return -1;
      if (!a.isCompleteMatch && b.isCompleteMatch) return 1;
      return (b.availableCount / b.totalCount) - (a.availableCount / a.totalCount);
    });
  }, [allRecipes, mealFilter, selectedIngredients, isVeryBudgetFilter, isQuickFilter, usesLeftoversFilter, isZeroMissingOnly, isSavedRecipesFilter, savedRecipeIds, familySize]);

  // Toggle Ingredient
  const toggleIngredient = (name: string) => {
    setSelectedIngredients(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  // Save / Bookmark Recipe
  const toggleSaveRecipe = (id: string) => {
    setSavedRecipeIds(prev => {
      if (prev.includes(id)) {
        showToast('تمت إزالة الوجبة من المحفوظات');
        return prev.filter(i => i !== id);
      } else {
        showToast('تم حفظ الوجبة في المحفوظات بنجاح ⭐');
        return [...prev, id];
      }
    });
  };

  // Phase 4C: Save / Bookmark Tip (Persists to tedbeera_phase4c_saved_tips)
  const toggleSaveTip = (id: string) => {
    setSavedTipIds(prev => {
      const isAlreadySaved = prev.includes(id);
      const updated = toggleSavedTipId(prev, id);
      if (!isAlreadySaved) {
        showToast('تم حفظ الحيلة في أفكاري المحفوظة 🔖');
      } else {
        showToast('تمت إزالة الحيلة من المحفوظات');
      }
      return updated;
    });
  };

  // Phase 4C: Toggle Tried Tip Achievement (Persists to tedbeera_phase4c_tried_tips)
  const handleToggleTriedTip = (id: string) => {
    setTriedTipIds(prev => {
      const isAlreadyTried = prev.includes(id);
      const updated = toggleTriedTipId(prev, id);
      if (!isAlreadyTried) {
        showToast('عاش! سجلنا إنك جربت الحيلة دي ووفرت في بيتك 👏');
      } else {
        showToast('تم إلغاء تحديد تجربة الحيلة');
      }
      return updated;
    });
  };

  // Phase 4C: Arabic Egyptian Voice Recognition Engine
  const startVoiceRecognition = async () => {
    if (voiceState === 'listening') {
      stopVoiceRecognition();
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await microphonePermission.request();
        if (!permission.granted) {
          setVoiceState('permission-denied');
          setVoiceFeedback('لازم تسمح لتطبيق تدبيرة باستخدام الميكروفون علشان الإدخال الصوتي يشتغل. افتح إعدادات التطبيق وفعّل إذن الميكروفون لو كنت رفضته قبل كده.');
          return;
        }
      }

      if (Capacitor.isNativePlatform()) {
        nativeSpeechListenersRef.current.forEach(handle => { try { handle.remove(); } catch {} });
        nativeSpeechListenersRef.current = [];
        const resultHandle = await microphonePermission.addListener('speechResult', (event) => {
          const transcript = event.transcript || '';
          const match = matchSpokenIngredients(transcript, COMMON_INGREDIENTS);
          if (match.matchedIngredients.length > 0) {
            setSelectedIngredients(prev => Array.from(new Set([...prev, ...match.matchedIngredients])));
            setVoiceState('success');
            setVoiceFeedback(match.feedbackMessage);
            showToast(match.feedbackMessage);
          } else {
            setVoiceState('no-match');
            setVoiceFeedback('ملقيناش مكونات مطابقة للكلام، جرّب تقول أسماء المكونات بوضوح.');
          }
          nativeSpeechListenersRef.current.forEach(handle => { try { handle.remove(); } catch {} });
          nativeSpeechListenersRef.current = [];
        });
        const errorHandle = await microphonePermission.addListener('speechError', (event) => {
          const error = event.error || '';
          setVoiceState(error === 'not-allowed' ? 'permission-denied' : error === 'no-speech' ? 'no-match' : 'error');
          setVoiceFeedback(error === 'no-speech' ? 'لم يتم التقاط صوت. اتكلم بوضوح وجرب تاني.' : error === 'network' ? 'خدمة التعرف الصوتي محتاجة اتصال بالإنترنت.' : 'تعذر تشغيل التعرف الصوتي. تأكد من تفعيل خدمة Google للتعرف على الكلام.');
          nativeSpeechListenersRef.current.forEach(handle => { try { handle.remove(); } catch {} });
          nativeSpeechListenersRef.current = [];
        });
        nativeSpeechListenersRef.current = [resultHandle, errorHandle];
        await microphonePermission.startListening();
        setVoiceState('listening');
        setVoiceFeedback('بتسمعك دلوقتي... اتكلم 🎙️');
        return;
      }

      if (!isVoiceSupported) {
        setVoiceState('unsupported');
        setVoiceFeedback('ميزة تحويل الكلام إلى نص غير مدعومة على هذا الجهاز حالياً. يمكنك اختيار المكونات يدوياً.');
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceState('listening');
        setVoiceFeedback('بتسمعك دلوقتي... اتكلم 🎙️ (مثال: عندي بيض وبطاطس وبصل)');
      };

      recognition.onresult = (event: any) => {
        try {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          const match = matchSpokenIngredients(transcript, COMMON_INGREDIENTS);
          if (match.matchedIngredients.length > 0) {
            setSelectedIngredients(prev => Array.from(new Set([...prev, ...match.matchedIngredients])));
            setVoiceState('success');
            setVoiceFeedback(match.feedbackMessage);
            showToast(match.feedbackMessage);
          } else {
            setVoiceState('no-match');
            setVoiceFeedback('ملقيناش مكونات مطابقة للكلام، جرّب تقول أسماء المكونات بوضوح.');
          }
        } catch {
          setVoiceState('error');
          setVoiceFeedback('حدث تعذر أثناء معالجة الصوت، جرب مرة أخرى.');
        }
      };

      recognition.onerror = (event: any) => {
        const err = event?.error;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setVoiceState('permission-denied');
          setVoiceFeedback('لم يتم السماح باستخدام الميكروفون. فعّل إذن الميكروفون لتطبيق تدبيرة من إعدادات أندرويد ثم حاول مرة أخرى.');
        } else if (err === 'no-speech') {
          setVoiceState('no-match');
          setVoiceFeedback('لم يتم التقاط أي صوت، تحدث بوضوح بالقرب من المايكروفون.');
        } else if (err === 'network') {
          setVoiceState('error');
          setVoiceFeedback('تعذر الاتصال بخدمة التعرف الصوتي، تأكد من الاتصال بالإنترنت.');
        } else {
          setVoiceState('error');
          setVoiceFeedback('حدث تعذر في الاستماع، يمكنك اختيار المكونات يدوياً.');
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setVoiceState(prev => (prev === 'listening' ? 'idle' : prev));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceState('error');
      setVoiceFeedback('تعذر بدء تشغيل المايكروفون، يمكنك اختيار المكونات يدوياً.');
    }
  };


  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setVoiceState('idle');
  };

  // Cleanup speech recognition on unmount or tab switch
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [activeTab]);

  // Add Missing Ingredients to Shopping List with Unit Merging and Safe Defaults
  const handleAddMissingToShopping = (missing: Ingredient[], baseServings: number) => {
    if (missing.length === 0) return;

    setShoppingItems(prev => {
      const updated = [...prev];

      missing.forEach(m => {
        const validServings = Math.max(1, baseServings || 4);
        const validFamilySize = Math.max(1, familySize || 4);
        const scaledAmt = parseSafeQuantity(((m.baseAmount || 1) / validServings) * validFamilySize);
        const normalizedName = m.name.trim();
        const normalizedUnit = (m.unit || 'حبة').trim();

        const existingIndex = updated.findIndex(
          item => item.name.trim().toLowerCase() === normalizedName.toLowerCase() && item.unit === normalizedUnit
        );

        if (existingIndex >= 0) {
          // Merge quantities without duplicate row
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: Math.round((updated[existingIndex].quantity + scaledAmt) * 10) / 10,
            isChecked: false // Reset check state if more is needed
          };
        } else {
          // Add new item with unpriced status (or estimate if common)
          updated.push({
            id: Math.random().toString(36).substring(2, 9),
            name: normalizedName,
            quantity: scaledAmt,
            unit: normalizedUnit,
            unitPrice: null, // Marked as "السعر غير محدد" explicitly
            isChecked: false
          });
        }
      });

      return updated;
    });

    showToast(`تم دمج ${missing.length} من النواقص في قائمة المشتريات بنجاح 🛒`);
  };

  const handleAddLowStockToShopping = (itemToAdd: { name: string; unit: string; quantity: number }) => {
    const normalizedName = itemToAdd.name.trim();
    if (!normalizedName) return;
    const normalizedUnit = (itemToAdd.unit || 'حبة').trim();
    const safeQty = parseSafeQuantity(itemToAdd.quantity || 1);

    setShoppingItems(prev => {
      const updated = [...prev];
      const existingIndex = updated.findIndex(
        item => item.name.trim().toLowerCase() === normalizedName.toLowerCase() && item.unit === normalizedUnit
      );

      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.round((updated[existingIndex].quantity + safeQty) * 10) / 10,
          isChecked: false
        };
      } else {
        updated.push({
          id: Math.random().toString(36).substring(2, 9),
          name: normalizedName,
          quantity: safeQty,
          unit: normalizedUnit,
          unitPrice: null,
          isChecked: false
        });
      }

      return updated;
    });

    showToast(`تمت إضافة "${normalizedName}" لقائمة النواقص 🛒`);
  };

  // ==========================================
  // Strict 100% Budget Redistribution Engine
  // ==========================================
  const parsedBudgetAmount = Math.max(0, isNaN(parseFloat(budgetAmount)) ? 0 : parseFloat(budgetAmount));

  const redistributePercentages = (targetIndex: number, newPct: number, current: number[]): number[] => {
    const size = current.length;
    if (size <= 1 || targetIndex < 0 || targetIndex >= size) return current;

    const clamped = Math.max(0, Math.min(100, Math.round(newPct)));
    const result = [...current];
    result[targetIndex] = clamped;

    const remaining = 100 - clamped;
    const otherIndices = current.map((_, i) => i).filter(i => i !== targetIndex);
    const otherSum = otherIndices.reduce((acc, i) => acc + Math.max(0, current[i]), 0);

    if (otherSum > 0) {
      let running = 0;
      for (let i = 0; i < otherIndices.length - 1; i++) {
        const idx = otherIndices[i];
        const ratio = current[idx] / otherSum;
        const alloc = Math.max(0, Math.min(remaining, Math.round(ratio * remaining)));
        result[idx] = alloc;
        running += alloc;
      }
      const lastIdx = otherIndices[otherIndices.length - 1];
      result[lastIdx] = Math.max(0, remaining - running);
    } else {
      const base = Math.floor(remaining / otherIndices.length);
      let rem = remaining % otherIndices.length;
      for (const idx of otherIndices) {
        result[idx] = base + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
      }
    }

    // Exact 100% invariant check
    const diff = 100 - result.reduce((a, b) => a + b, 0);
    if (diff !== 0) {
      const adjustIdx = otherIndices[0] ?? targetIndex;
      result[adjustIdx] = Math.max(0, result[adjustIdx] + diff);
    }

    return result;
  };

  const handleUpdatePercentage = (index: number, newPct: number) => {
    const next = redistributePercentages(index, newPct, categoryPercentages);
    setCategoryPercentages(next);
  };

  const handleApplyPreset = (presetPcts: number[]) => {
    if (presetPcts.length !== categories.length) {
      showToast('النموذج مخصص للتوزيع الخماسي القياسي');
      return;
    }
    setCategoryPercentages(presetPcts);
    showToast('تم تطبيق نموذج الميزانية بنجاح ✅');
  };

  // Add Custom Category
  const handleAddCustomCategory = () => {
    if (!newCatName.trim()) return;

    const newCat: BudgetCategoryDef = {
      id: 'cat_' + Math.random().toString(36).substring(2, 7),
      name: newCatName.trim(),
      defaultPct: 10,
      tip: newCatTip.trim() || 'بند مخصص لمصروفات إضافية خاصة ببيتك.',
      iconName: 'tag',
      isCustom: true
    };

    const newCats = [...categories, newCat];
    setCategories(newCats);

    // Rebalance percentages to accommodate new category strictly at 100%
    const count = newCats.length;
    const basePct = Math.floor(100 / count);
    const rem = 100 % count;
    const initialPcts = newCats.map((_, i) => basePct + (i < rem ? 1 : 0));
    setCategoryPercentages(initialPcts);

    setNewCatName('');
    setNewCatTip('');
    setIsAddCategoryModalOpen(false);
    showToast(`تمت إضافة بند "${newCat.name}" وإعادة التوزيع بنسبة 100% بالتمام 🎉`);
  };

  // Budget calculations use the active salary cycle, not every historical expense.
  const payCycleRange = useMemo(() => getPayCycleRange(paydayDay), [paydayDay]);
  const payCycleExpenses = useMemo(
    () => filterExpensesForPayCycle(expenses, payCycleRange),
    [expenses, payCycleRange]
  );
  const displayedExpenses = useMemo(
    () => (showAllExpenseHistory ? [...expenses].sort((a, b) => b.date.localeCompare(a.date)) : payCycleExpenses),
    [showAllExpenseHistory, expenses, payCycleExpenses]
  );

  // Budget Reconciled Breakdown & Calculations
  const budgetBreakdown = useMemo(() => {
    return reconcileBudgetAllocations(parsedBudgetAmount, categoryPercentages, categories, payCycleExpenses);
  }, [parsedBudgetAmount, categoryPercentages, categories, payCycleExpenses]);

  const totalSpentAll = useMemo(() => {
    return payCycleExpenses.reduce((acc, curr) => {
      const amt = parseSafePrice(curr.amount) || 0;
      return acc + amt;
    }, 0);
  }, [payCycleExpenses]);

  const totalRemainingAll = Math.round(parsedBudgetAmount - totalSpentAll);

  // Phase 4B: Monthly Payday Countdown & Daily Spending Cap Analytics
  const paydayAnalytics: PaydayCountdownResult = useMemo(() => {
    return calculatePaydayCountdown(paydayDay, totalRemainingAll);
  }, [paydayDay, totalRemainingAll]);

  // Phase 4B: Visual Spending Donut Segments (Proportional to actual category spending)
  const donutSegments: DonutSegment[] = useMemo(() => {
    return calculateDonutSegments(budgetBreakdown, totalSpentAll);
  }, [budgetBreakdown, totalSpentAll]);

  // Phase 4B: Selected Segment in Donut Chart for Interactive Detail Panel
  const selectedDonutSegment = useMemo(() => {
    if (!selectedDonutSegmentId) return null;
    return donutSegments.find(s => s.categoryId === selectedDonutSegmentId) || null;
  }, [selectedDonutSegmentId, donutSegments]);

  // Add Expense
  const handleAddExpense = () => {
    const amt = parseSafePrice(expenseAmount);
    if (amt === null || amt <= 0) {
      showToast('يرجى كتابة مبلغ صحيح أكبر من الصفر');
      return;
    }

    const newExp: ExpenseRecord = {
      id: 'exp_' + Math.random().toString(36).substring(2, 8),
      categoryId: expenseCategoryId,
      amount: amt,
      date: expenseDate,
      description: expenseDesc.trim() || 'مصروف عام'
    };

    setExpenses(prev => [newExp, ...prev]);
    setExpenseAmount('');
    setExpenseDesc('');
    setIsAddExpenseModalOpen(false);
    showToast('تم تسجيل المصروف وتحديث الرصيد فوراً 💳');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    showToast('تم حذف المصروف');
  };

  const handleDeleteExtraIncome = (id: string) => {
    setExtraIncomeRecords(prev => prev.filter(item => item.id !== id));
    try {
      const remaining = financeTransactionsRepository.read().filter(item => item.id !== id);
      financeTransactionsRepository.write(remaining);
    } catch {}
    showToast('تم حذف بند الدخل الإضافي');
  };

  const handleSaveBudgetPlan = () => {
    const plan: SavedBudgetPlan = {
      id: Math.random().toString(36).substring(2, 9),
      categoryTitle: `ميزانية ${new Date().toLocaleDateString('ar-EG')}`,
      totalAmount: parsedBudgetAmount,
      slices: budgetBreakdown.map(b => ({ name: b.name, percentage: b.percentage, amount: b.allocated })),
      date: new Date().toLocaleDateString('ar-EG')
    };
    setSavedBudgets(prev => [plan, ...prev]);
    showToast('تم حفظ خطة الميزانية في المحفوظات بنجاح 💼');
  };

  // Daily Challenge Logic
  const todayChallenge = useMemo(() => {
    return getDeterministicDailyChallenge(todayDateKey || '2026-10-26');
  }, [todayDateKey]);

  const toggleDailyCompletion = () => {
    const next = !dailyCompleted;
    setDailyCompleted(next);
    try {
      const completedMap = JSON.parse(localStorage.getItem('tedbeera_daily_completed') || '{}');
      completedMap[todayDateKey] = next;
      localStorage.setItem('tedbeera_daily_completed', JSON.stringify(completedMap));
    } catch {}
    showToast(next ? 'عاش! مبروك إنجاز تحدي النهارده 🎉' : 'تم إلغاء تحديد الإنجاز');
  };

  const handleShareDailyChallenge = () => {
    const shareText = `🎉 أنجزت تحدي النهارده في تطبيق تدبيرة مصر:\n"${todayChallenge.title}"\n\nخطوة عملية لتوفير بيتنا ومصاريفنا بدون حرمان 💪\n#تدبيرة #مصر #تدبير_البيت`;
    if (navigator.share) {
      navigator.share({
        title: 'تدبيرة – تدبيرتك النهارده',
        text: shareText
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('تم نسخ رسالة الإنجاز! جاهزة للمشاركة على واتساب 📲');
    }
  };

  const handleShareTip = (tip: DailyIdea) => {
    const shareText = `💡 نصيحة تدبيرة لبيتك:\n"${tip.title}"\n\n${tip.description}\n\nنصيحة عملية: ${tip.practicalTip}\n#تدبيرة_مصر #توفير_البيت`;
    if (navigator.share) {
      navigator.share({
        title: tip.title,
        text: shareText
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('تم نسخ النصيحة للحافظة بنجاح 📲');
    }
  };

  // Phase 4C: Filtered Daily Ideas with Exact 5 Categories and Saved Tips Mode
  const filteredDailyIdeas = useMemo(() => {
    return DAILY_IDEAS.filter(idea => {
      // 1. If in 'saved' view mode, only show bookmarked tips
      if (dailyTipsViewMode === 'saved') {
        if (!savedTipIds.includes(idea.id)) return false;
      }

      // 2. Exact 5 Categories Filter Matching
      let matchCat = true;
      if (selectedDailyCategory !== 'الكل') {
        if (selectedDailyCategory === 'تنظيف') {
          matchCat = idea.tags.includes('تنظيف') || idea.category === 'تنظيف';
        } else if (selectedDailyCategory === 'توفير كهرباء') {
          matchCat = idea.tags.includes('توفير كهرباء') || idea.tags.includes('كهرباء');
        } else if (selectedDailyCategory === 'مطبخ وتغذية') {
          matchCat = idea.tags.includes('مطبخ وتغذية') || idea.category === 'طعام' || idea.tags.includes('مطبخ');
        } else if (selectedDailyCategory === 'حيل تسوق') {
          matchCat = idea.tags.includes('حيل تسوق') || idea.tags.includes('ميزانية') || idea.tags.includes('تسوق') || idea.tags.includes('كاش');
        } else {
          matchCat = idea.tags.includes(selectedDailyCategory) || idea.category === selectedDailyCategory;
        }
      }

      // 3. Search query
      const trimmed = dailySearch.trim();
      const matchSearch = !trimmed ||
        idea.title.includes(trimmed) ||
        idea.description.includes(trimmed) ||
        idea.practicalTip.includes(trimmed);

      return matchCat && matchSearch;
    });
  }, [selectedDailyCategory, dailySearch, dailyTipsViewMode, savedTipIds]);

  // Robust Shopping List Totals (Separates Known Subtotal from Unpriced Items)
  const shoppingTotals: ShoppingTotals = useMemo(() => {
    return calculateShoppingTotals(shoppingItems);
  }, [shoppingItems]);

  const updateItemQty = (id: string, delta: number) => {
    setShoppingItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextQty = Math.max(0.5, Math.round((parseSafeQuantity(item.quantity) + delta) * 10) / 10);
        return { ...item, quantity: nextQty };
      }
      return item;
    }));
  };

  // Set or Edit Item Unit Price
  const handleSaveItemPrice = () => {
    if (!editingPriceItem) return;
    const parsed = parseSafePrice(editingPriceItem.currentPrice);

    setShoppingItems(prev => prev.map(item => {
      if (item.id === editingPriceItem.id) {
        return { ...item, unitPrice: parsed };
      }
      return item;
    }));

    setEditingPriceItem(null);
    showToast(parsed !== null ? 'تم تحديث السعر وإعادة الحساب فوراً 🏷️' : 'تم تعيين الصنف كغير مسعر');
  };

  // Feature 1: Share Unpurchased Shopping List via WhatsApp (WebView & PWA safe)
  const handleShareShoppingWhatsApp = () => {
    const shareResult = formatWhatsAppShoppingMessage(shoppingItems);
    if (shareResult.isEmpty) {
      showToast('قائمة النواقص فارغة! لا توجد طلبات للمشاركة 🧺');
      return;
    }

    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareResult.message)}`;
    if (isNativeApp) {
      window.location.assign(waUrl);
    } else {
      const link = document.createElement('a');
      link.href = waUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    showToast(`تم تجهيز ${shareResult.unpurchasedCount} طلب للمشاركة عبر واتساب 📲`);
  };

  // Feature 3: Export User Data as Standardized Versioned JSON Backup
  const handleExportData = () => {
    try {
      const readFeatureBackupValue = <T,>(key: string, fallback: T): T => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return fallback;
          const parsed = JSON.parse(raw);
          const value = parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && 'data' in parsed
            ? parsed.data
            : parsed;
          return value as T;
        } catch {
          return fallback;
        }
      };
      let completedMap: Record<string, boolean> = {};
      try {
        completedMap = JSON.parse(localStorage.getItem('tedbeera_daily_completed') || '{}');
      } catch {}

      const payload = createBackupPayload({
        familySize,
        budgetAmount,
        categories,
        categoryPercentages,
        expenses,
        shoppingItems,
        savedRecipeIds,
        savedTipIds,
        savedBudgets,
        selectedIngredients,
        dailyCompleted: completedMap,
        triedTipIds,
        paydayDay,
        weeklyPlanUnlocked: isWeeklyPlanUnlocked,
        reminderEnabled: isDailyReminderEnabled,
        reminderTime,
        householdProfile: readFeatureBackupValue<Record<string, unknown> | null>('tedbeera_household_profile_v1', null),
        inventoryItems: readFeatureBackupValue<Record<string, unknown>[]>('tedbeera_inventory_v1', []),
        householdTasks: readFeatureBackupValue<Record<string, unknown>[]>('tedbeera_household_tasks_v1', []),
        savingsGoals: readFeatureBackupValue<Record<string, unknown>[]>('tedbeera_savings_goals_v1', []),
        customRecipes: customRecipes as unknown as Record<string, unknown>[],
        financeTransactions: financeTransactionsRepository.read() as unknown as Record<string, unknown>[]
      });

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const todayDate = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `tedbeera-backup-${todayDate}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('تم تصدير ملف النسخة الاحتياطية بنجاح 💾');
      setIsSettingsModalOpen(false);
    } catch {
      showToast('حدث خطأ أثناء تصدير النسخة الاحتياطية ⚠️');
    }
  };

  // Feature 3: Select Backup File & Validate Schema Before Prompting Confirmation
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateBackupPayload(parsed);

        if (!validation.isValid || !validation.normalizedData) {
          showToast(validation.error || 'الملف غير صالح: تنسيق البيانات غير متوافق مع تدبيرة ⚠️');
          return;
        }

        // Store validated data in pending state and open confirmation modal
        setPendingRestoreData(validation.normalizedData);
        setIsSettingsModalOpen(false);
        setIsRestoreConfirmModalOpen(true);
      } catch {
        showToast('خطأ: تعذر قراءة الملف. تأكد من سلامة ملف الـ JSON ⚠️');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Feature 3: Execute Restore with Rollback Protection & Immediate State/Storage Refresh
  const handleConfirmRestore = async () => {
    if (!pendingRestoreData) return;

    // 1. Snapshot every affected storage key so a partial write can be rolled back atomically.
    const restoreStorageKeys = [
      'tedbeera_family_size', 'tedbeera_budget_amount', 'tedbeera_categories', 'tedbeera_percentages',
      'tedbeera_expenses', 'tedbeera_shopping_items', 'tedbeera_saved_recipes',
      'tedbeera_phase4c_saved_tips', 'tedbeera_saved_tips', 'tedbeera_saved_budgets',
      'tedbeera_custom_pantry', 'tedbeera_phase4c_tried_tips', 'tedbeera_payday_day',
      REWARD_PLAN_STORAGE_KEY, REMINDER_STORAGE_KEY, 'tedbeera_daily_completed',
      'tedbeera_household_profile_v1', 'tedbeera_inventory_v1',
      'tedbeera_household_tasks_v1', 'tedbeera_savings_goals_v1', 'tedbeera_phase4d_reminder_time',
      'tedbeera_custom_recipes', 'tedbeera_finance_transactions_v1', 'tedbeera_finance_migrated_v1'
    ];
    const storageSnapshot = new Map(
      restoreStorageKeys.map(key => {
        try {
          return [key, localStorage.getItem(key)] as const;
        } catch {
          return [key, null] as const;
        }
      })
    );

    // 2. Create Pre-Restore React State Snapshot for Rollback Protection
    const preRestoreSnapshot = {
      familySize,
      budgetAmount,
      categories,
      categoryPercentages,
      expenses,
      shoppingItems,
      savedRecipeIds,
      savedTipIds,
      savedBudgets,
      selectedIngredients,
      customRecipes,
      extraIncomeRecords,
      triedTipIds,
      paydayDay,
      weeklyPlanUnlocked: isWeeklyPlanUnlocked,
      reminderEnabled: isDailyReminderEnabled,
      reminderTime
    };

    try {
      const d = pendingRestoreData;

      // 2. Immediate React State Refresh
      setFamilySize(d.familySize);
      setBudgetAmount(d.budgetAmount);
      setCategories(d.categories);
      setCategoryPercentages(d.categoryPercentages);
      setExpenses(d.expenses);
      setShoppingItems(d.shoppingItems);
      setSavedRecipeIds(d.savedRecipeIds);
      setSavedTipIds(d.savedTipIds);
      setSavedBudgets(d.savedBudgets);
      setSelectedIngredients(d.selectedIngredients);
      if (d.triedTipIds) setTriedTipIds(d.triedTipIds);
      if (d.paydayDay !== undefined) setPaydayDay(d.paydayDay);
      if (d.weeklyPlanUnlocked !== undefined) setIsWeeklyPlanUnlocked(d.weeklyPlanUnlocked);
      if (d.reminderEnabled !== undefined) setIsDailyReminderEnabled(d.reminderEnabled);

      // 3. Immediate LocalStorage Synchronization Across All Keys
      localStorage.setItem('tedbeera_family_size', String(d.familySize));
      localStorage.setItem('tedbeera_budget_amount', d.budgetAmount);
      localStorage.setItem('tedbeera_categories', JSON.stringify(d.categories));
      localStorage.setItem('tedbeera_percentages', JSON.stringify(d.categoryPercentages));
      localStorage.setItem('tedbeera_expenses', JSON.stringify(d.expenses));
      localStorage.setItem('tedbeera_shopping_items', JSON.stringify(d.shoppingItems));
      localStorage.setItem('tedbeera_saved_recipes', JSON.stringify(d.savedRecipeIds));
      localStorage.setItem('tedbeera_phase4c_saved_tips', JSON.stringify(d.savedTipIds));
      localStorage.setItem('tedbeera_saved_tips', JSON.stringify(d.savedTipIds));
      localStorage.setItem('tedbeera_saved_budgets', JSON.stringify(d.savedBudgets));
      localStorage.setItem('tedbeera_custom_pantry', JSON.stringify(d.selectedIngredients));
      if (d.triedTipIds) {
        localStorage.setItem('tedbeera_phase4c_tried_tips', JSON.stringify(d.triedTipIds));
      }
      if (d.paydayDay !== undefined && d.paydayDay !== null) {
        localStorage.setItem('tedbeera_payday_day', d.paydayDay.toString());
      }
      if (d.weeklyPlanUnlocked !== undefined) {
        localStorage.setItem(REWARD_PLAN_STORAGE_KEY, String(d.weeklyPlanUnlocked));
      }
      if (d.reminderEnabled !== undefined) {
        localStorage.setItem(REMINDER_STORAGE_KEY, String(d.reminderEnabled));
      }
      const restoredReminderTime = d.reminderTime || '08:00';
      localStorage.setItem('tedbeera_phase4d_reminder_time', restoredReminderTime);
      setReminderTime(restoredReminderTime);
      if (d.dailyCompleted) {
        localStorage.setItem('tedbeera_daily_completed', JSON.stringify(d.dailyCompleted));
      }
      // Restore the newer household-management domains; absent fields in legacy backups remain untouched.
      if (d.householdProfile !== undefined && d.householdProfile !== null) {
        localStorage.setItem('tedbeera_household_profile_v1', JSON.stringify(d.householdProfile));
      }
      if (d.inventoryItems !== undefined) {
        localStorage.setItem('tedbeera_inventory_v1', JSON.stringify(d.inventoryItems));
      }
      if (d.householdTasks !== undefined) {
        localStorage.setItem('tedbeera_household_tasks_v1', JSON.stringify(d.householdTasks));
      }
      if (d.savingsGoals !== undefined) {
        localStorage.setItem('tedbeera_savings_goals_v1', JSON.stringify(d.savingsGoals));
      }
      if (d.customRecipes !== undefined) {
        const restoredCustomRecipes = d.customRecipes as unknown as Recipe[];
        setCustomRecipes(restoredCustomRecipes);
        localStorage.setItem('tedbeera_custom_recipes', JSON.stringify(restoredCustomRecipes));
      }
      if (d.financeTransactions !== undefined) {
        const validTransactions = (d.financeTransactions as unknown[]).filter(isFinanceTransaction);
        financeTransactionsRepository.write(validTransactions);
        setExtraIncomeRecords(validTransactions.filter(t => t.type === 'income'));
      }

      const reminderResult = d.reminderEnabled
        ? await getLocalNotificationService().scheduleDailyReminder(...restoredReminderTime.split(':').map(Number) as [number, number])
        : await getLocalNotificationService().cancelDailyReminder();
      setIsDailyReminderEnabled(Boolean(d.reminderEnabled && reminderResult.success));
      if (d.reminderEnabled && !reminderResult.success) {
        localStorage.setItem(REMINDER_STORAGE_KEY, 'false');
      }
      setPendingRestoreData(null);
      setIsRestoreConfirmModalOpen(false);
      showToast(d.reminderEnabled && !reminderResult.success
        ? `تمت استعادة البيانات، لكن تعذرت إعادة تفعيل التنبيهات: ${reminderResult.message}`
        : 'تمت استعادة النسخة الاحتياطية بنجاح وتحديث كافة الأقسام! 🎉');
    } catch {
      // 4. Restore all previous storage values, including feature repositories.
      for (const [key, value] of storageSnapshot) {
        try {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch {
          // Continue best-effort rollback for remaining keys.
        }
      }
      // Restore React state snapshot as well.
      setFamilySize(preRestoreSnapshot.familySize);
      setBudgetAmount(preRestoreSnapshot.budgetAmount);
      setCategories(preRestoreSnapshot.categories);
      setCategoryPercentages(preRestoreSnapshot.categoryPercentages);
      setExpenses(preRestoreSnapshot.expenses);
      setShoppingItems(preRestoreSnapshot.shoppingItems);
      setSavedRecipeIds(preRestoreSnapshot.savedRecipeIds);
      setSavedTipIds(preRestoreSnapshot.savedTipIds);
      setSavedBudgets(preRestoreSnapshot.savedBudgets);
      setSelectedIngredients(preRestoreSnapshot.selectedIngredients);
      setCustomRecipes(preRestoreSnapshot.customRecipes);
      setExtraIncomeRecords(preRestoreSnapshot.extraIncomeRecords);
      setTriedTipIds(preRestoreSnapshot.triedTipIds);
      setPaydayDay(preRestoreSnapshot.paydayDay);
      setIsWeeklyPlanUnlocked(preRestoreSnapshot.weeklyPlanUnlocked);
      setIsDailyReminderEnabled(preRestoreSnapshot.reminderEnabled);
      setReminderTime(preRestoreSnapshot.reminderTime);

      setPendingRestoreData(null);
      setIsRestoreConfirmModalOpen(false);
      showToast('حدث خطأ أثناء الاستعادة: تم استرجاع البيانات السابقة بأمان ⚠️');
    }
  };

  // Wipe All Data
  const handleWipeAllData = async () => {
    await getLocalNotificationService().cancelDailyReminder();
    setSavedRecipeIds([]);
    setCustomRecipes([]);
    setExtraIncomeRecords([]);
    setSelectedIngredients(['بيض', 'طماطم', 'بصل']);
    setSavedTipIds([]);
    setTriedTipIds([]);
    setSavedBudgets([]);
    setShoppingItems([]);
    setExpenses([]);
    setDailyCompleted(false);
    setFamilySize(4);
    setBudgetAmount('2500');
    setCategories(DEFAULT_BUDGET_CATEGORIES);
    setCategoryPercentages(DEFAULT_BUDGET_CATEGORIES.map(c => c.defaultPct));
    setPaydayDay(null);
    setIsWeeklyPlanUnlocked(false);
    setIsDailyReminderEnabled(false);

    const keysToRemove = [
      'tedbeera_saved_recipes',
      'tedbeera_phase4c_saved_tips',
      'tedbeera_saved_tips',
      'tedbeera_phase4c_tried_tips',
      'tedbeera_saved_budgets',
      'tedbeera_shopping_items',
      'tedbeera_expenses',
      'tedbeera_daily_completed',
      'tedbeera_family_size',
      'tedbeera_budget_amount',
      'tedbeera_categories',
      'tedbeera_percentages',
      'tedbeera_payday_day',
      REWARD_PLAN_STORAGE_KEY,
      REMINDER_STORAGE_KEY,
      'tedbeera_phase4d_reminder_time',
      'tedbeera_household_profile_v1',
      'tedbeera_inventory_v1',
      'tedbeera_household_tasks_v1',
      'tedbeera_savings_goals_v1',
      'tedbeera_custom_recipes',
      'tedbeera_custom_pantry',
      'tedbeera_finance_transactions_v1',
      'tedbeera_finance_migrated_v1',
      'tadbeera_online_recipes_v1',
      'tedbeera_notification_test_sent_v1'
    ];
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });

    setIsWipeModalOpen(false);
    setIsSettingsModalOpen(false);
    showToast('تمت إعادة ضبط المصنع ومسح جميع البيانات بنجاح 🔒');
  };

  // Clear Shopping List Only
  const handleClearShoppingList = () => {
    setShoppingItems([]);
    setIsClearShoppingConfirmOpen(false);
    showToast('تم إفراغ قائمة النواقص بالكامل 🧺');
  };

  return (
    <div className="min-h-screen h-[100dvh] w-full overflow-hidden bg-[#FBF8F1] text-[#3F4037] font-['Cairo',sans-serif] flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" aria-live="polite" className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-3 right-3 z-[100] mx-auto max-w-md bg-[#626B49] text-white px-5 py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 border border-[#D8C69A]">
          <Sparkles className="w-4 h-4 text-[#FFE54C]" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* MAIN FULL-SCREEN APP CONTAINER */}
      <main className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Top App Bar */}
        <header className="tadbeera-appbar bg-[#F5F0E5] text-[#43523D] pt-[env(safe-area-inset-top)] shadow-sm border-b border-[#E8E0D1] shrink-0">
          <div className="w-full max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">🇪🇬</span>
              <h1 className="font-extrabold text-sm sm:text-base truncate">تدبيرة — كل جنيه ليه قيمة 💛</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isNativeApp && <PWAInstallButton />}
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-1.5 rounded-lg bg-[#E8EDDF] hover:bg-[#DCE5D3] text-[#5F7651] transition"
                title="إعدادات وأمان البيانات"
                aria-label="إعدادات وأمان البيانات"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Screen Content with shared layout clearance ensuring 70-90px breathing room */}
        <div className={`tadbeera-screen-content flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 bg-[#FBF8F1] [&>*]:max-w-2xl [&>*]:mx-auto [&>*]:w-full ${getBottomScrollPaddingClass(adStatus)} ${isNativeApp ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-[calc(1.5rem+env(safe-area-inset-bottom))]"}`}>


              {activeTab === 'home' && (
                <section className="space-y-3.5" dir="rtl" aria-label="الرئيسية">
                  <div className="rounded-[26px] bg-gradient-to-br from-[#667B58] via-[#758765] to-[#526748] text-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[11px] text-[#F4EAD5] font-semibold">بيتك في إيدك 🌿</span>
                        <h2 className="text-xl font-extrabold mt-1">أهلاً بيك في تدبيرة</h2>
                        <p className="text-[11px] text-white/85 mt-1 leading-5">كل احتياجات بيتك اليومية في مكان واحد.</p>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-center">
                        <Users className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-[10px] block">أفراد الأسرة</span>
                        <strong className="text-lg leading-none">{familySize}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div><h3 className="font-extrabold text-sm text-[#454A3C]">تحتاجي إيه النهارده؟</h3><p className="text-[10px] text-[#8A887C] mt-0.5">اختاري القسم وابدئي على طول</p></div>
                    <span className="text-[10px] text-[#8A887C]">اختصارات سريعة</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => setActiveTab('food')} className="text-right rounded-2xl border border-[#EEDFD4] bg-[#FFFEFA] p-3 shadow-sm active:scale-[0.98] transition"><span className="w-9 h-9 rounded-xl bg-[#F7EDE4] text-[#A66D4C] flex items-center justify-center"><Utensils className="w-5 h-5" /></span><b className="block text-xs mt-2.5 text-[#454A3C]">المطبخ والوصفات</b><small className="block text-[10px] text-[#969184] mt-0.5">اختاري طبخة النهارده</small></button>
                    <button type="button" onClick={() => setActiveTab('saved')} className="text-right rounded-2xl border border-[#E9E1D3] bg-[#FFFEFA] p-3 shadow-sm active:scale-[0.98] transition"><span className="w-9 h-9 rounded-xl bg-[#F4EEE2] text-[#98764C] flex items-center justify-center"><ShoppingCart className="w-5 h-5" /></span><b className="block text-xs mt-2.5 text-[#454A3C]">قائمة المشتريات</b><small className="block text-[10px] text-[#969184] mt-0.5">{shoppingItems.filter(item => !item.isChecked).length} أصناف لسه محتاجة تتجاب</small></button>
                    <button type="button" onClick={() => setActiveTab('budget')} className="text-right rounded-2xl border border-[#E2E8DC] bg-[#FFFEFA] p-3 shadow-sm active:scale-[0.98] transition"><span className="w-9 h-9 rounded-xl bg-[#EEF1E8] text-[#667B58] flex items-center justify-center"><Wallet className="w-5 h-5" /></span><b className="block text-xs mt-2.5 text-[#454A3C]">ميزانية البيت</b><small className="block text-[10px] text-[#969184] mt-0.5">المبلغ المحدد: {budgetAmount || '—'} ج.م</small></button>
                    <button type="button" onClick={() => setActiveTab('household')} className="text-right rounded-2xl border border-[#E8E2D5] bg-[#FFFEFA] p-3 shadow-sm active:scale-[0.98] transition"><span className="w-9 h-9 rounded-xl bg-[#F0EEE7] text-[#857B60] flex items-center justify-center"><Home className="w-5 h-5" /></span><b className="block text-xs mt-2.5 text-[#454A3C]">إدارة البيت</b><small className="block text-[10px] text-[#969184] mt-0.5">المخزون والمهام المنزلية</small></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewItemName('');
                        setNewItemQty('1');
                        setNewItemUnit('حبة');
                        setNewItemUnitPrice('');
                        setIsAddItemModalOpen(true);
                      }}
                      className="min-h-[44px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] text-white py-2.5 px-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span>إضافة نواقص للسوق</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setExpenseAmount(''); setExpenseDesc(''); setIsAddExpenseModalOpen(true); }}
                      className="min-h-[44px] rounded-xl bg-[#F3EBDD] text-[#526748] border border-[#E8E0D1] py-2.5 px-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <Receipt className="w-4 h-4 shrink-0" />
                      <span>تسجيل مصروف</span>
                    </button>
                  </div>
                  <div className="rounded-2xl border border-[#E8E1D3] bg-[#F3EBDD] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-extrabold text-[#66563F]">💡 تدبيرة اليوم</span><span className={dailyCompleted ? "text-[10px] font-bold text-[#526748]" : "text-[10px] font-bold text-[#8A704D]"}>{dailyCompleted ? "أنجزتي تحدي النهارده ✓" : "خطوة صغيرة لبيت أهدى"}</span></div>
                    <p className="text-[11px] text-[#796B56] leading-5">{todayChallenge.title}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => { setDailyTipsViewMode('all'); setActiveTab('daily'); }}
                        className="min-h-[40px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] text-white px-3 py-1.5 text-[11px] font-bold transition whitespace-nowrap"
                      >
                        {dailyCompleted ? 'راجعي أفكار التوفير' : 'اعرفي تفاصيل تدبيرة اليوم'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDailyTipsViewMode('saved'); setActiveTab('daily'); }}
                        className="min-h-[40px] rounded-xl border border-[#D4C7AE] bg-white hover:bg-[#FAF6EC] text-[#526748] px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1 transition whitespace-nowrap"
                      >
                        <Bookmark className="w-3.5 h-3.5 shrink-0" />
                        <span>أفكاري المحفوظة ({savedTipIds.length})</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {activeTab === 'household' && (
                <ErrorBoundary fallbackTitle="تعذر تحميل شاشة إدارة البيت">
                  <React.Suspense fallback={<div className="rounded-2xl bg-white border border-[#E8E0D1] p-4 text-center text-xs text-[#667B58]">بنجهز إدارة البيت…</div>}>
                    <HouseholdHub
                      onAddLowStockToShopping={handleAddLowStockToShopping}
                      budgetSummary={{
                        totalBudget: parsedBudgetAmount,
                        totalSpent: totalSpentAll,
                        totalRemaining: totalRemainingAll
                      }}
                      onOpenBudget={() => setActiveTab('budget')}
                    />
                  </React.Suspense>
                </ErrorBoundary>
              )}
              {/* ======================================================== */}
              {/* === TAB 1: تدبيرة الأكل === */}
              {/* ======================================================== */}
              {activeTab === 'food' && (
                <div className="space-y-4">
                  {kitchenView === 'online' ? (
                    <ErrorBoundary fallbackTitle="تعذر تحميل البحث الصوتي عن الوصفات" onReset={() => setKitchenView('main')}>
                      <React.Suspense fallback={<div className="rounded-2xl border border-emerald-200 bg-white p-5 text-center text-sm text-gray-600">بنجهز مساعد الوصفات الصوتي…</div>}>
                        <OnlineRecipeSearch familySize={familySize} onBack={() => setKitchenView('main')} />
                      </React.Suspense>
                    </ErrorBoundary>
                  ) : kitchenView === 'offline' ? (
                    <section dir="rtl" className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => setKitchenView('main')} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 min-h-[40px]">
                          <ChevronRight className="h-4 w-4" /> رجوع للمطبخ
                        </button>
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">تعمل بدون إنترنت</span>
                      </div>
                      <div className="rounded-2xl bg-[#F1F5EC] p-4">
                        <h2 className="text-lg font-black text-[#40533A]">مكتبة وصفات تدبيرة 🌿</h2>
                        <p className="mt-1 text-xs leading-5 text-[#68745F]">كل الوصفات المصرية والبيتية المحفوظة داخل التطبيق في مكان واحد، وتقدر تفتحها وتفلترها بدون إنترنت.</p>
                      </div>
                      <input value={offlineRecipeQuery} onChange={event => setOfflineRecipeQuery(event.target.value)} placeholder="ابحث في الوصفات المجانية..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500" />

                      {/* Meal Category, Saved & Ready Filters */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs items-center">
                        {[
                          { key: 'all', label: 'الكل 🍽️' },
                          { key: 'breakfast', label: 'فطار 🍳' },
                          { key: 'lunch', label: 'غداء 🍲' },
                          { key: 'dinner', label: 'عشاء 🌙' }
                        ].map(cat => (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setMealFilter(cat.key as MealTypeFilter)}
                            className={`min-h-[40px] px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition ${
                              mealFilter === cat.key
                                ? 'bg-[#1E5631] text-white shadow-sm'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setIsSavedRecipesFilter(prev => !prev)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
                            isSavedRecipesFilter
                              ? 'bg-[#D8C69A] text-[#3E3524] shadow-sm'
                              : 'bg-white border border-[#E4DECF] text-[#626B49] hover:bg-[#FAF6EC]'
                          }`}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isSavedRecipesFilter ? 'fill-[#3E3524]' : ''}`} />
                          <span>المحفوظة ({savedRecipeIds.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsZeroMissingOnly(prev => !prev)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
                            isZeroMissingOnly
                              ? 'bg-[#1E5631] text-white shadow-sm'
                              : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                          }`}
                          title="إظهار فقط الوجبات الجاهزة بنسبة 100% دون أي مكونات ناقصة"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>اطبخ باللي عندي فقط</span>
                          {isZeroMissingOnly && <Check className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Quick Dietary / Speed Filters */}
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setIsVeryBudgetFilter(prev => !prev)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap ${
                            isVeryBudgetFilter ? 'bg-[#1E5631] text-white' : 'bg-white border border-gray-200 text-gray-700'
                          }`}
                        >
                          💰 اقتصادي جداً
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsQuickFilter(prev => !prev)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap ${
                            isQuickFilter ? 'bg-[#1E5631] text-white' : 'bg-white border border-gray-200 text-gray-700'
                          }`}
                        >
                          ⚡ وجبات سريعة
                        </button>
                        <button
                          type="button"
                          onClick={() => setUsesLeftoversFilter(prev => !prev)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap ${
                            usesLeftoversFilter ? 'bg-[#1E5631] text-white' : 'bg-white border border-gray-200 text-gray-700'
                          }`}
                        >
                          ♻️ استغلال بواقي الأكل
                        </button>
                      </div>

                      {(() => {
                        const normalizedQuery = offlineRecipeQuery.trim().toLocaleLowerCase('ar');
                        const filteredLibraryRecipes = matchedRecipes.filter(({ recipe }) =>
                          !normalizedQuery || recipe.name.toLocaleLowerCase('ar').includes(normalizedQuery)
                        );
                        return (
                          <>
                            <div className="flex items-center justify-between text-[11px] text-gray-500">
                              <span>عدد الوصفات: {filteredLibraryRecipes.length}</span>
                              {(isSavedRecipesFilter || mealFilter !== 'all' || isZeroMissingOnly || isVeryBudgetFilter || isQuickFilter || usesLeftoversFilter || normalizedQuery) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSavedRecipesFilter(false);
                                    setMealFilter('all');
                                    setIsZeroMissingOnly(false);
                                    setIsVeryBudgetFilter(false);
                                    setIsQuickFilter(false);
                                    setUsesLeftoversFilter(false);
                                    setOfflineRecipeQuery('');
                                  }}
                                  className="font-bold text-[#1E5631] hover:underline"
                                >
                                  إظهار الكل
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {filteredLibraryRecipes.map(({ recipe, scaledCost, availableCount, totalCount }) => {
                                const isSaved = savedRecipeIds.includes(recipe.id);
                                return (
                                  <div key={recipe.id} className="flex w-full items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm transition hover:border-emerald-300">
                                    <button type="button" onClick={() => setSelectedRecipeModal(recipe)} className="flex min-w-0 flex-1 items-center gap-3 text-right">
                                      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F1F5EC]">
                                        {recipe.imageUrl && !brokenImages[recipe.id] ? <img src={recipe.imageUrl} alt={recipe.name} loading="lazy" onError={() => handleImageError(recipe.id)} className="h-full w-full object-cover" /> : <SvgIllustration type={recipe.svgFallbackIcon || 'koshari'} />}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <strong className="block truncate text-sm text-gray-900">{recipe.name}</strong>
                                        <span className="mt-1 block text-[10px] text-gray-500">{recipe.mealType === 'breakfast' ? 'فطار' : recipe.mealType === 'lunch' ? 'غداء' : 'عشاء'} · {recipe.prepTimeMinutes} دقيقة · لـ {familySize} أفراد</span>
                                        <span className="mt-0.5 block text-[10px] font-semibold text-[#1E5631]">
                                          ~{scaledCost} ج.م · متوفر {availableCount} من {totalCount}
                                        </span>
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleSaveRecipe(recipe.id)}
                                      aria-label={isSaved ? 'إزالة من المحفوظات' : 'حفظ الوصفة'}
                                      title={isSaved ? 'إزالة من المحفوظات' : 'حفظ الوصفة'}
                                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                                        isSaved
                                          ? 'border-[#D8C69A] bg-[#F7F0DE] text-[#765B3A]'
                                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                                      }`}
                                    >
                                      <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-[#765B3A]' : ''}`} />
                                    </button>
                                  </div>
                                );
                              })}
                              {filteredLibraryRecipes.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
                                  {isSavedRecipesFilter
                                    ? 'لسه مفيش وصفات محفوظة. اضغطي على علامة الحفظ بجانب أي وصفة للرجوع لها بدون نت.'
                                    : 'ملقيناش وصفة مطابقة للفلاتر الحالية. جرّبي تغيير البحث أو إظهار الكل.'}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </section>
                  ) : (
                    <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => { setIsSavedRecipesFilter(false); setKitchenView('offline'); }}
                      className="flex w-full items-center justify-between rounded-2xl border border-[#DCE5D3] bg-[#F1F5EC] p-3 text-right transition hover:bg-[#E8EFE1]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#526748]"><BookOpen className="h-5 w-5" /></span>
                        <span><strong className="block text-xs text-[#40533A]">مكتبة الوصفات</strong><small className="mt-0.5 block text-[10px] text-[#68745F]">وصفات مجانية جاهزة داخل التطبيق</small></span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#526748]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsSavedRecipesFilter(true); setKitchenView('offline'); }}
                      className="flex w-full items-center justify-between rounded-2xl border border-[#E6D9B8] bg-[#FAF5E8] p-3 text-right transition hover:bg-[#F3EBD6]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#765B3A]"><Bookmark className="h-5 w-5" /></span>
                        <span><strong className="block text-xs text-[#5E482C]">الوجبات المحفوظة ({savedRecipeIds.length})</strong><small className="mt-0.5 block text-[10px] text-[#7D6A4E]">وصفاتك المفضلة بدون إنترنت</small></span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#765B3A]" />
                    </button>
                  </div>
                  <button type="button" onClick={() => setKitchenView('online')} className="flex w-full items-center justify-between rounded-2xl border border-[#DCE2D0] bg-[#F1F3EA] p-3 text-right transition hover:bg-[#E8EBDD]">
                    <span className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#78815B]"><Mic className="h-5 w-5" /></span>
                      <span><strong className="block text-xs text-[#626B49]">ابحث عن وصفة أونلاين 🎙️</strong><small className="mt-0.5 block text-[10px] text-[#78815B]">اتكلم أو اكتب اسم الأكلة، واسمع طريقة التحضير</small></span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#78815B]" />
                  </button>
                  {/* Brand Concept Motto Card */}
                  <div className="bg-[#626B49] text-white p-3 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-[#D8C69A] block">تدبيرة — كل جنيه ليه قيمة 💛</span>
                      <span className="text-[10px] text-[#F4EAD5]">تكلفة الوجبة التقديرية ومقادير الأكل حسب عدد أفراد بيتك 🇪🇬</span>
                    </div>
                    <span className="text-xs bg-[#D8C69A] text-[#626B49] font-black px-2 py-0.5 rounded-lg">ج.م EGP</span>
                  </div>
                  {/* Family Size Scaler Bar */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="p-1.5 rounded-lg bg-[#F1F3EA] text-[#626B49]">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-800 block">عدد أفراد الأسرة:</span>
                        <span className="text-[10px] text-gray-400">تعديل المقادير والتكلفة تلقائياً</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFamilySize(prev => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#626B49] font-black text-sm flex items-center justify-center transition"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-extrabold text-[#626B49] text-sm">{familySize}</span>
                      <button
                        onClick={() => setFamilySize(prev => prev + 1)}
                        className="w-7 h-7 rounded-lg bg-[#626B49] hover:bg-[#1E5631] text-white font-black text-sm flex items-center justify-center transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Phase 4D: Weekly Meal Plan Banner & Feature Gate */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#F7F0DE] text-amber-700 flex items-center justify-center shrink-0">
                          <CalendarCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-extrabold text-xs text-[#626B49]">خطة وجبات الأسبوع التوفيرية الكاملة</h3>
                            {isWeeklyPlanUnlocked ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <Unlock className="w-2.5 h-2.5" />
                                <span>مفتوحة ✓</span>
                              </span>
                            ) : (
                              <span className="bg-[#EFE5C8] text-[#765B3A] text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                <span>مقفولة</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            جدول وجبات السبت إلى الجمعة (فطار، غداء، عشاء) لـ {familySize} أفراد مع جدول التسوق المجمع.
                          </p>
                        </div>
                      </div>

                      {isWeeklyPlanUnlocked && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsWeeklyPlanUnlocked(false);
                            localStorage.removeItem(REWARD_PLAN_STORAGE_KEY);
                            showToast('تم إعادة قفل الخطة للتجربة 🔒');
                          }}
                          className="text-[10px] text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
                          title="إعادة القفل لتجربة محاكاة الإعلان مرة أخرى"
                        >
                          إعادة القفل للتجربة
                        </button>
                      )}
                    </div>

                    {!isWeeklyPlanUnlocked ? (
                      /* Locked State: Rewarded Ad Entry Point */
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 p-3 rounded-xl border border-[#E6D9B8]/80 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-950 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-[#D8C69A]" />
                            <span>فتح جدول وجبات 7 أيام وجدول التسوق المجمع</span>
                          </span>
                          <span className="text-[10px] bg-amber-200/80 text-[#765B3A] font-bold px-1.5 py-0.5 rounded">
                            مجاني بمكافأة 🎁
                          </span>
                        </div>
                        <p className="text-[11px] text-[#765B3A]/80 leading-relaxed">
                          تخلصي من حيرة "هنطبخ إيه النهاردة؟" مع خطة متكاملة محسوبة بالجرام والتكلفة للأسبوع كله.
                        </p>
                        <button
                          type="button"
                          onClick={handleRequestRewardedAd}
                          className="w-full bg-[#626B49] hover:bg-[#1E5631] text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5 text-[#D8C69A] fill-[#D8C69A]" />
                          <span>شاهد إعلاناً قصيراً لفتح جدول وجبات الأسبوع</span>
                        </button>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                          <span>• محاكاة إعلان تجريبي (AdMob Test Mode)</span>
                          <span>• بدون أي خصم من رصيدك أو بياناتك</span>
                        </div>
                      </div>
                    ) : (
                      /* Unlocked State: Full 7-Day Interactive Plan & Consolidated Shopping */
                      <div className="space-y-3 pt-1 border-t border-gray-100">
                        {/* Days Horizontal Chips */}
                        <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
                          {WEEKLY_DAYS_SCHEDULE.map(day => (
                            <button
                              key={day.dayId}
                              type="button"
                              onClick={() => setSelectedPlanDayId(day.dayId)}
                              className={`px-2.5 py-1 rounded-xl font-bold whitespace-nowrap transition ${
                                selectedPlanDayId === day.dayId
                                  ? 'bg-[#626B49] text-white shadow-xs'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <span>{day.dayName}</span>
                            </button>
                          ))}
                        </div>

                        {/* Selected Day Content */}
                        {(() => {
                          const activeDay = WEEKLY_DAYS_SCHEDULE.find(d => d.dayId === selectedPlanDayId) || WEEKLY_DAYS_SCHEDULE[0];
                          const bRecipe = getRecipeById(activeDay.breakfastRecipeId);
                          const lRecipe = getRecipeById(activeDay.lunchRecipeId);
                          const dRecipe = getRecipeById(activeDay.dinnerRecipeId);
                          const dayTotal = (bRecipe ? calculateRecipeScaledCost(bRecipe, familySize) : 0) +
                                           (lRecipe ? calculateRecipeScaledCost(lRecipe, familySize) : 0) +
                                           (dRecipe ? calculateRecipeScaledCost(dRecipe, familySize) : 0);

                          return (
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2.5">
                              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                                <div>
                                  <span className="font-extrabold text-xs text-[#626B49]">جدول يوم {activeDay.dayName}</span>
                                  <span className="text-[10px] text-gray-500 block">{activeDay.theme}</span>
                                </div>
                                <span className="bg-[#FFE54C]/50 text-[#626B49] font-bold text-[11px] px-2 py-0.5 rounded-lg border border-[#D8C69A]/50">
                                  تكلفة اليوم: ~{dayTotal} ج.م
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs">
                                {/* Breakfast */}
                                {bRecipe && (
                                  <div
                                    onClick={() => setSelectedRecipeModal(bRecipe)}
                                    className="bg-white p-2 rounded-lg border border-gray-100 flex items-center justify-between cursor-pointer hover:border-[#626B49] transition"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] bg-[#EFE5C8] text-[#765B3A] font-bold px-1.5 py-0.2 rounded">فطار</span>
                                      <span className="font-bold text-gray-800 text-[11px] truncate max-w-[170px]">{bRecipe.name}</span>
                                    </div>
                                    <span className="text-[10px] text-[#626B49] font-bold">~{calculateRecipeScaledCost(bRecipe, familySize)} ج.م</span>
                                  </div>
                                )}

                                {/* Lunch */}
                                {lRecipe && (
                                  <div
                                    onClick={() => setSelectedRecipeModal(lRecipe)}
                                    className="bg-white p-2 rounded-lg border border-gray-100 flex items-center justify-between cursor-pointer hover:border-[#626B49] transition"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] bg-[#E8EBDD] text-[#626B49] font-bold px-1.5 py-0.2 rounded">غداء</span>
                                      <span className="font-bold text-gray-800 text-[11px] truncate max-w-[170px]">{lRecipe.name}</span>
                                    </div>
                                    <span className="text-[10px] text-[#626B49] font-bold">~{calculateRecipeScaledCost(lRecipe, familySize)} ج.م</span>
                                  </div>
                                )}

                                {/* Dinner */}
                                {dRecipe && (
                                  <div
                                    onClick={() => setSelectedRecipeModal(dRecipe)}
                                    className="bg-white p-2 rounded-lg border border-gray-100 flex items-center justify-between cursor-pointer hover:border-[#626B49] transition"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] bg-purple-100 text-purple-900 font-bold px-1.5 py-0.2 rounded">عشاء</span>
                                      <span className="font-bold text-gray-800 text-[11px] truncate max-w-[170px]">{dRecipe.name}</span>
                                    </div>
                                    <span className="text-[10px] text-[#626B49] font-bold">~{calculateRecipeScaledCost(dRecipe, familySize)} ج.م</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Consolidated Shopping Actions */}
                        <div className="pt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsConsolidatedShoppingModalOpen(true)}
                            className="flex-1 bg-white hover:bg-gray-50 text-[#626B49] font-bold py-2 px-2.5 rounded-xl text-[11px] border border-[#DCE2D0] flex items-center justify-center gap-1.5 transition"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            <span>جدول التسوق المجمع 📋</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleAddConsolidatedPlanToShopping}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition shadow-xs"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>+ مقادير الأسبوع للمشتريات</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ingredients Drawer */}
                  <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#626B49]">
                          المكونات المتوفرة في بيتك ({selectedIngredients.length}):
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Phase 4C: Voice Recognition Microphone Button */}
                        <button
                          type="button"
                          onClick={voiceState === 'listening' ? stopVoiceRecognition : startVoiceRecognition}
                          className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl transition ${
                            voiceState === 'listening'
                              ? 'bg-rose-600 text-white animate-pulse shadow-sm ring-2 ring-rose-300'
                              : 'bg-[#F1F3EA] hover:bg-[#E8EBDD] text-[#626B49] border border-[#DCE2D0]'
                          }`}
                          title="اختيار المكونات بالصوت باللهجة المصرية"
                          aria-label="اختيار المكونات بالصوت"
                        >
                          {voiceState === 'listening' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                              <span>بتسمعك...</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5 text-[#626B49]" />
                              <span>بالصوت 🎙️</span>
                            </>
                          )}
                        </button>

                        {selectedIngredients.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedIngredients([])}
                            className="text-[11px] text-red-600 font-semibold hover:underline px-1"
                          >
                            مسح الكل
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Phase 4C: Voice Listening / Match Feedback Card */}
                    {voiceState !== 'idle' && voiceFeedback && (
                      <div className={`mb-2.5 p-2 rounded-xl text-xs flex items-center justify-between border transition ${
                        voiceState === 'listening'
                          ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse'
                          : voiceState === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : voiceState === 'no-match'
                          ? 'bg-[#F7F0DE] border-[#E6D9B8] text-[#765B3A]'
                          : 'bg-gray-50 border-gray-200 text-gray-800'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          {voiceState === 'listening' ? (
                            <Mic className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-bounce" />
                          ) : voiceState === 'success' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="text-[11px] font-medium leading-tight">{voiceFeedback}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setVoiceState('idle'); setVoiceFeedback(null); }}
                          className="text-gray-400 hover:text-gray-600 p-0.5 text-xs font-bold"
                          title="إخفاء التنبيه"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_INGREDIENTS.map(ing => {
                        const isSelected = selectedIngredients.includes(ing);
                        return (
                          <button
                            key={ing}
                            onClick={() => toggleIngredient(ing)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                              isSelected
                                ? 'bg-[#626B49] text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span>{ing}</span>
                          </button>
                        );
                      })}
                    </div>

                    <ErrorBoundary fallbackTitle="تعذر تحميل مكتبة الاقتراحات الذكية">
                      <React.Suspense fallback={<div className="rounded-xl bg-white border border-gray-100 p-3 text-center text-[11px] text-gray-500">بنجهز اقتراحات الوجبات…</div>}>
                        <IngredientRecipeFinder availableIngredients={selectedIngredients} familySize={familySize} />
                      </React.Suspense>
                    </ErrorBoundary>
                  </div>

                  {/* Add Custom Recipe Button */}
                  <button
                    type="button"
                    onClick={() => setIsAddCustomRecipeModalOpen(true)}
                    className="w-full bg-white border border-[#626B49] text-[#626B49] hover:bg-[#F1F3EA] font-bold py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>أضف أكلتك الخاصة 🍳</span>
                  </button>

                  <div className="rounded-2xl border border-[#E4DECF] bg-[#FFFDF8] p-4 text-center text-sm text-[#626B49]">
                    كل وصفات تدبيرة موجودة في مكان واحد داخل <strong>مكتبة الوصفات</strong> بالأعلى. افتح المكتبة للبحث والاختيار وعرض المقادير والخطوات.
                  </div>
                    </>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* === TAB 2: تدبيرة الفلوس ومتابعة المصاريف === */}
              {/* ======================================================== */}
              {activeTab === 'budget' && (
                <div className="space-y-4">
                  {/* Core Brand Identity Hero Banner */}
                  <div className="bg-gradient-to-r from-[#626B49] via-[#4D5538] to-[#626B49] text-white p-3.5 rounded-2xl shadow-sm border-b-2 border-[#D8C69A] space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💛</span>
                        <h2 className="text-sm font-black text-[#D8C69A]">تدبيرة — كل جنيه ليه قيمة</h2>
                      </div>
                      <span className="bg-[#D8C69A] text-[#626B49] text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                        ميزانية البيت 🇪🇬
                      </span>
                    </div>
                    <p className="text-xs text-[#F4EAD5] font-medium">
                      وفّر بذكاء، ودبّر بيتك، وخلي كل جنيه في مكانه.
                    </p>
                  </div>

                  {/* Quick Expense Logger Action */}
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseAmount('');
                      setExpenseDesc('');
                      setIsAddExpenseModalOpen(true);
                    }}
                    className="w-full bg-[#626B49] hover:bg-[#1E5631] text-white font-extrabold py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Plus className="w-4 h-4 text-[#D8C69A]" />
                    <span>⚡ تسجيل مصروف فوري</span>
                  </button>

                  {/* Smart Financial Advisor Banner */}
                  <div className="bg-gradient-to-r from-amber-50 via-[#F5F7F0] to-emerald-50 p-3.5 rounded-2xl border border-[#E6D9B8]/80 shadow-sm space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-[#EFE5C8] text-amber-800 flex items-center justify-center shrink-0">
                        <Lightbulb className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-xs text-[#626B49]">💡 توجيه ذكي للميزانية</span>
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-relaxed pr-9">
                      {(() => {
                        const bAmt = parseFloat(budgetAmount) || 2500;
                        const spent = totalSpentAll;
                        const ratio = bAmt > 0 ? (spent / bAmt) * 100 : 0;
                        const daysLeft = paydayAnalytics.daysRemaining > 0 ? paydayAnalytics.daysRemaining : 10;

                        if (ratio > 95) {
                          return "🚨 انتبه: دخلت في مرحلة استهلاك الطوارئ، ركّز على الأساسيات فقط حتى موعد الراتب.";
                        }
                        const overCategory = budgetBreakdown.find(c => c.allocated > 0 && (c.spent / c.allocated) > 0.85);
                        if (overCategory && daysLeft > 10) {
                          const catRatio = Math.round((overCategory.spent / overCategory.allocated) * 100);
                          return `⚠️ تنبيه: صرفت ${catRatio}% من ميزانية ${overCategory.name} ولسه باقي ${daysLeft} يوم على المرتب.. ننصح بتقليل خروج السوبرماركت.`;
                        }
                        return "عاش! معدل صرفك متوازن ومناسب لأيام الشهر المتبقية. استمر في التدبير الصحيح 👏";
                      })()}
                    </p>
                  </div>

                  {/* Feature 3: Monthly Payday Cycle & Countdown Widget */}
                  <div className="bg-gradient-to-l from-[#4D5538] to-[#626B49] text-white p-3.5 rounded-2xl shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-[#D8C69A]">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#F4EAD5] block font-medium">دورة الراتب الشهري</span>
                          <span className="text-xs font-extrabold text-white">
                            {paydayAnalytics.isConfigured ? (
                              paydayAnalytics.isToday ? (
                                <span className="text-[#D8C69A]">النهارده موعد الراتب 🎉</span>
                              ) : (
                                <span>باقي {paydayAnalytics.daysRemaining} أيام على موعد الراتب القادم</span>
                              )
                            ) : (
                              <span>حدد موعد راتبك الشهري</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setTempPaydayInput(paydayDay ? paydayDay.toString() : '25');
                          setIsPaydayModalOpen(true);
                        }}
                        className="text-[11px] bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 text-white border border-white/20"
                        title="تعديل أو تحديد يوم نزول الراتب"
                      >
                        <Clock className="w-3 h-3 text-[#D8C69A]" />
                        <span>{paydayAnalytics.isConfigured ? `يوم ${paydayAnalytics.paydayDay}` : 'تحديد اليوم'}</span>
                      </button>
                    </div>

                    {paydayAnalytics.isConfigured ? (
                      <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-[#F4EAD5] block">الحد المقترح للصرف اليومي:</span>
                          {!paydayAnalytics.isBudgetExhausted && paydayAnalytics.dailyCap !== null ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-black text-[#D8C69A]">~{paydayAnalytics.dailyCap}</span>
                              <span className="text-[10px] text-white">ج.م/يوم</span>
                              <span className="text-[10px] text-white/90 mr-1 font-normal">
                                ({paydayAnalytics.daysRemaining > 0 ? `على مدار ${paydayAnalytics.daysRemaining} يوم` : 'اليوم'})
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-rose-300">
                              ⚠️ تم استهلاك الميزانية بالكامل
                            </span>
                          )}
                        </div>

                        <div className="text-left">
                          <span className="text-[10px] text-[#F4EAD5] block">الموعد المحدد:</span>
                          <span className="text-xs font-bold text-white">
                            {paydayAnalytics.effectivePayday} في الشهر
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs">
                        <p className="text-[11px] text-[#F4EAD5] leading-tight">
                          اختر يوم نزول الراتب لحساب الأيام المتبقية تلقائياً وتحديد حد الصرف اليومي الذكي.
                        </p>
                        <button
                          onClick={() => {
                            setTempPaydayInput('25');
                            setIsPaydayModalOpen(true);
                          }}
                          className="bg-[#D8C69A] hover:bg-[#FFA000] text-[#626B49] font-extrabold text-[11px] px-2.5 py-1 rounded-lg shrink-0 mr-2 transition"
                        >
                          ضبط الآن
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Budget Input & Balance Cards */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">الميزانية الإجمالية المتاحة:</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={budgetAmount}
                          onChange={(e) => setBudgetAmount(e.target.value)}
                          placeholder="مثال: 2500"
                          className="w-full text-lg font-extrabold text-[#626B49] border border-gray-300 rounded-xl px-3 py-2 pr-12 focus:outline-none focus:border-[#626B49]"
                        />
                        <span className="absolute left-3 top-2.5 font-bold text-sm text-gray-400">ج.م</span>
                      </div>
                    </div>

                    {/* Financial Snapshot Tiles */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                      <div className="bg-[#F1F3EA]/70 p-2.5 rounded-xl border border-[#E4DECF]">
                        <span className="text-[10px] text-gray-500 block">إجمالي المصروف الفعلي</span>
                        <span className="text-sm font-black text-[#626B49]">{totalSpentAll} ج.م</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${
                        totalRemainingAll >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        <span className="text-[10px] text-gray-500 block">المتبقي في المحفظة</span>
                        <span className="text-sm font-black">{totalRemainingAll} ج.م</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature 2: Visual Spending Donut Chart Card */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#F1F3EA] text-[#626B49]">
                          <PieChart className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-extrabold text-gray-900">توزيع المصروف الفعلي حسب البنود</h3>
                          <span className="text-[10px] text-gray-400">تحليل إنفاق دورة الراتب الحالية ({payCycleRange.label})</span>
                        </div>
                      </div>
                      {selectedDonutSegmentId && (
                        <button
                          onClick={() => setSelectedDonutSegmentId(null)}
                          className="text-[10px] text-gray-500 hover:text-gray-700 underline"
                        >
                          إلغاء التحديد
                        </button>
                      )}
                    </div>

                    {totalSpentAll === 0 ? (
                      <div className="py-6 px-4 text-center border border-dashed border-gray-200 rounded-xl space-y-2">
                        <div className="w-10 h-10 rounded-full bg-gray-100 mx-auto flex items-center justify-center text-gray-400">
                          <PieChart className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-gray-600">لا توجد مصاريف مسجلة حتى الآن لرسم المخطط 📊</p>
                        <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                          سجّل أول عملية صرف من زر "تسجيل مصروف" بالأسفل لتشاهد رسم بياني يوضح نسب إنفاقك على كل بند.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* SVG Donut Graphic & Central Label */}
                        <div className="relative flex items-center justify-center py-2">
                          <svg viewBox="0 0 100 100" className="w-44 h-44 -rotate-90 transform">
                            {/* Background Track */}
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke="#F1F5F9"
                              strokeWidth="11"
                            />
                            {/* Category Segments */}
                            {donutSegments.map((seg) => {
                              const isSelected = selectedDonutSegmentId === seg.categoryId;
                              return (
                                <circle
                                  key={seg.categoryId}
                                  cx="50"
                                  cy="50"
                                  r="38"
                                  fill="transparent"
                                  stroke={seg.color}
                                  strokeWidth={isSelected ? "14" : "11"}
                                  strokeDasharray={seg.strokeDasharray}
                                  strokeDashoffset={seg.strokeDashoffset}
                                  strokeLinecap="butt"
                                  className="cursor-pointer transition-all duration-300 hover:opacity-90"
                                  onClick={() => setSelectedDonutSegmentId(isSelected ? null : seg.categoryId)}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`${seg.categoryName}: ${seg.spent} ج.م (${seg.sharePercentage}%)`}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      setSelectedDonutSegmentId(isSelected ? null : seg.categoryId);
                                    }
                                  }}
                                />
                              );
                            })}
                          </svg>

                          {/* Center Text in Donut */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                            <span className="text-[10px] text-gray-400 font-medium">إجمالي المصروف</span>
                            <span className="text-base font-black text-[#626B49] leading-tight">{totalSpentAll}</span>
                            <span className="text-[10px] font-bold text-gray-500">ج.م</span>
                          </div>
                        </div>

                        {/* Interactive Detail Panel */}
                        {selectedDonutSegment && (
                          <div className="bg-[#F1F3EA]/70 p-3 rounded-xl border border-[#DCE2D0] text-xs space-y-1.5 animate-fadeIn">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: selectedDonutSegment.color }} />
                                <span>{selectedDonutSegment.categoryName}</span>
                              </div>
                              <span className="bg-[#626B49] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                                {selectedDonutSegment.sharePercentage}% من إجمالي الصرف
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div>
                                <span className="text-gray-500 block">المنصرف الفعلي:</span>
                                <span className="font-extrabold text-[#626B49]">{selectedDonutSegment.spent} ج.م</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block">الميزانية المخصصة:</span>
                                <span className="font-bold text-gray-700">{selectedDonutSegment.allocated} ج.م</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-500 pt-0.5">
                              نسبة استهلاك ميزانية هذا البند: <span className="font-bold text-gray-800">{selectedDonutSegment.budgetPercentage}%</span>
                            </div>
                          </div>
                        )}

                        {/* Arabic Legend */}
                        <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-1.5 text-xs">
                          {budgetBreakdown.map((cat) => {
                            const seg = donutSegments.find(s => s.categoryId === cat.id);
                            const color = seg ? seg.color : '#CBD5E1';
                            const isSelected = selectedDonutSegmentId === cat.id;

                            return (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  if (cat.spent > 0) {
                                    setSelectedDonutSegmentId(isSelected ? null : cat.id);
                                  }
                                }}
                                className={`p-1.5 rounded-lg text-right transition flex items-center justify-between ${
                                  isSelected ? 'bg-[#F1F3EA] border border-[#A7B28E]' : 'hover:bg-gray-50'
                                } ${cat.spent === 0 ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-[11px] font-bold text-gray-800 truncate">{cat.name}</span>
                                </div>
                                <span className="text-[10px] font-black text-gray-700 shrink-0 mr-1">{cat.spent} ج.م</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preset Shortcuts */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-gray-700">نماذج ميزانية مقترحة:</span>
                      <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        ✅ المجموع: 100% بالتمام
                      </span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {BUDGET_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleApplyPreset(preset.percentages)}
                          className="bg-white border border-gray-200 hover:border-[#626B49] text-gray-700 text-xs px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap shadow-xs transition"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feature 1: Category Slices, Progress Bars, Overrun Warnings & Allocation Sliders */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-gray-900">بنود الميزانية والإنفاق:</span>
                      <button
                        onClick={() => setIsAddCategoryModalOpen(true)}
                        className="text-xs font-bold text-[#626B49] flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة بند مخصص</span>
                      </button>
                    </div>

                    {budgetBreakdown.map((cat, idx) => {
                      const analytics = calculateCategoryAnalytics(cat.allocated, cat.spent);

                      return (
                        <div key={cat.id} className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[#626B49]">
                                {renderCategoryIcon(cat.iconName)}
                              </div>
                              <div>
                                <span className="font-bold text-sm text-gray-800 block">{cat.name}</span>
                                {cat.isCustom && (
                                  <span className="text-[9px] bg-[#EFE5C8] text-amber-800 px-1 py-0.2 rounded font-bold">مخصص</span>
                                )}
                              </div>
                            </div>
                            <div className="text-left">
                              <span className="bg-[#F1F3EA] text-[#626B49] text-xs font-extrabold px-2 py-0.5 rounded-md inline-block">
                                {cat.percentage}% من الميزانية
                              </span>
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                استهلاك: {analytics.progressPercentage}%
                              </span>
                            </div>
                          </div>

                          {/* Amount, Spent & Remaining / Exceeded */}
                          <div className="flex items-baseline justify-between text-xs pt-0.5">
                            <div>
                              <span className="text-base font-black text-[#626B49]">{cat.allocated} ج.م</span>
                              <span className="text-gray-400 text-[10px] mr-1">المخصص</span>
                            </div>
                            <div className="text-left">
                              <span className="font-bold text-gray-800 block">
                                صُرف: {cat.spent} ج.م
                              </span>
                              {analytics.isOverBudget ? (
                                <span className="text-rose-600 font-extrabold text-[10px] block">
                                  تجاوز بـ: {analytics.exceededAmount} ج.م
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold text-[10px] block">
                                  متبقي: {analytics.remainingAmount} ج.م
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Dynamic Color Progress Bar (Green <80%, Amber 80-99%, Red >=100%) */}
                          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                analytics.colorStatus === 'red'
                                  ? 'bg-rose-500'
                                  : analytics.colorStatus === 'amber'
                                  ? 'bg-[#D97706]'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${analytics.visualPercentage}%` }}
                              role="progressbar"
                              aria-valuenow={analytics.progressPercentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>

                          {/* Overrun Warning Badge (Only when spending > allocated) */}
                          {analytics.isOverBudget && (
                            <div className="bg-rose-50 text-rose-800 text-[11px] font-bold px-2.5 py-1.5 rounded-xl flex items-center justify-between border border-rose-200">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>تجاوز الميزانية بـ {analytics.exceededAmount} ج.م</span>
                              </div>
                              <span className="text-[10px] bg-rose-200/80 text-rose-900 px-1.5 py-0.5 rounded font-extrabold">
                                {analytics.progressPercentage}% استهلاك
                              </span>
                            </div>
                          )}

                          <p className="text-[11px] text-gray-500 leading-normal">{cat.tip}</p>

                          {/* Synchronized Slider with Boundary Controls (Strict 100% Invariant Preserved) */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() => handleUpdatePercentage(idx, cat.percentage - 5)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs px-2 py-1 rounded-lg transition"
                              title="إنقاص 5%"
                            >
                              -5%
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={cat.percentage}
                              onChange={(e) => handleUpdatePercentage(idx, parseInt(e.target.value))}
                              className="w-full accent-[#626B49] cursor-pointer"
                            />
                            <button
                              onClick={() => handleUpdatePercentage(idx, cat.percentage + 5)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs px-2 py-1 rounded-lg transition"
                              title="زيادة 5%"
                            >
                              +5%
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      onClick={handleSaveBudgetPlan}
                      className="w-full bg-[#626B49] hover:bg-[#1E5631] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                    >
                      <Bookmark className="w-4 h-4 text-[#FFE54C]" />
                      <span>حفظ خطة الميزانية في المحفوظات</span>
                    </button>
                  </div>

                  {/* Expense Records Section */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-xs text-gray-900">سجل المصاريف الحقيقية:</h3>
                        <span className="text-[10px] text-gray-400">{showAllExpenseHistory ? 'كل المصروفات المسجلة' : 'مصروفات دورة الراتب الحالية'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowAllExpenseHistory(value => !value)}
                          className="text-[10px] font-bold text-[#626B49] border border-[#E4DECF] rounded-lg px-2 py-1"
                        >
                          {showAllExpenseHistory ? 'الدورة الحالية' : 'كل السجل'}
                        </button>
                        <button
                        onClick={() => setIsAddExpenseModalOpen(true)}
                        className="bg-[#626B49] hover:bg-[#1E5631] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>تسجيل مصروف</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 -mt-1">{showAllExpenseHistory ? 'كل السجل المالي' : `دورة الراتب الحالية: ${payCycleRange.label}`}</div>
                    {displayedExpenses.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                        {showAllExpenseHistory ? 'لا توجد مصروفات مسجلة حتى الآن.' : 'لا توجد مصروفات مسجلة في دورة الراتب الحالية. المصروفات السابقة محفوظة ولا تؤثر على رصيد الدورة الجديدة.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {displayedExpenses.slice(0, 5).map(exp => {
                          const cat = categories.find(c => c.id === exp.categoryId);
                          return (
                            <div key={exp.id} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-gray-800">{exp.description}</span>
                                  <span className="text-[10px] bg-[#E8EBDD] text-[#626B49] px-1.5 py-0.2 rounded font-medium">
                                    {cat?.name || 'عام'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-400 mt-0.5 block">{exp.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-[#626B49]">{exp.amount} ج.م</span>
                                <button
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="text-gray-400 hover:text-red-600 p-1"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Extra Income Records (Preserved from legacy household finance) */}
                  {extraIncomeRecords.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-xs text-[#1E5631]">سجل الدخل الإضافي ({extraIncomeRecords.length})</h3>
                        <span className="text-[10px] text-gray-400">بيانات محفوظة من سجل البيت</span>
                      </div>
                      <div className="space-y-2">
                        {extraIncomeRecords.map(inc => (
                          <div key={inc.id} className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 flex items-center justify-between text-xs">
                            <div className="flex-1">
                              <span className="font-bold text-gray-800 block">{inc.description || inc.categoryId}</span>
                              <span className="text-[10px] text-gray-500">{inc.date} · {inc.categoryId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-[#1E5631]">+{inc.amount} ج.م</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteExtraIncome(inc.id)}
                                className="text-gray-400 hover:text-red-600 p-1"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved Budget Plans (Consolidated into الميزانية) */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-xs text-gray-900">الميزانيات المحفوظة ({savedBudgets.length})</h3>
                        <span className="text-[10px] text-gray-400">خطط التقسيم اللي حفظتيها للرجوع لها بدون نت</span>
                      </div>
                    </div>
                    {savedBudgets.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                        لسه مفيش خطط ميزانية محفوظة. بعد تعديل النسب بالأعلى، اضغطي "حفظ خطة الميزانية" لتظهر هنا.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {savedBudgets.map(b => (
                          <div key={b.id} className="p-3.5 rounded-2xl border border-[#E4DECF] bg-[#FFFDF8] space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-sm text-[#1E5631]">{b.categoryTitle}</h4>
                                <span className="text-xs font-extrabold text-gray-800">{b.totalAmount} جنيه مصري</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSavedBudgets(prev => prev.filter(x => x.id !== b.id))}
                                className="text-red-500 hover:text-red-700 p-1.5"
                                title="حذف الخطة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="text-xs space-y-1 pt-1 border-t border-gray-100">
                              {b.slices.map((s, idx) => (
                                <div key={idx} className="flex justify-between text-gray-600">
                                  <span>{s.name} ({s.percentage}%)</span>
                                  <span className="font-bold text-gray-800">{Math.round(s.amount)} ج.م</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* === TAB 3: تدبيرة اليوم (تحت الرئيسية) === */}
              {/* ======================================================== */}
              {activeTab === 'daily' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('home')}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 min-h-[40px]"
                    >
                      <ChevronRight className="h-4 w-4" /> رجوع للرئيسية
                    </button>
                    <span className="text-xs bg-[#D8C69A] text-[#626B49] font-black px-2.5 py-1 rounded-full">كل جنيه ليه قيمة 💛</span>
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold text-[#626B49]">تدبيرة اليوم 💡</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      وفّر بذكاء، ودبّر بيتك، وخلي كل جنيه في مكانه مع حيل يومية مجربة.
                    </p>
                  </div>

                  {/* Daily Signature Challenge */}
                  <div className={`p-4 rounded-2xl border transition ${
                    dailyCompleted
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-[#FFE54C]/25 border-[#D8C69A]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-md ${
                        dailyCompleted ? 'bg-emerald-600 text-white' : 'bg-[#626B49] text-white'
                      }`}>
                        {dailyCompleted ? 'تم إنجاز التحدي! 🎉' : '🎯 تدبيرتك النهارده'}
                      </span>
                      <span className="text-[11px] text-gray-500">{todayDateKey}</span>
                    </div>

                    <h3 className="font-extrabold text-sm text-gray-900 mt-2">{todayChallenge.title}</h3>
                    <p className="text-xs text-gray-700 mt-1 leading-relaxed">{todayChallenge.description}</p>
                    <span className="inline-block mt-2 text-[11px] text-amber-800 bg-[#EFE5C8] font-semibold px-2 py-0.5 rounded">
                      ✨ {todayChallenge.impactTag}
                    </span>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200/60">
                      <button
                        onClick={toggleDailyCompletion}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                          dailyCompleted
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white border border-gray-300 text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{dailyCompleted ? 'مُنجز بنجاح' : 'علّم كـ مُنجز'}</span>
                      </button>

                      <button
                        onClick={handleShareDailyChallenge}
                        className="text-xs font-bold text-[#626B49] bg-white border border-gray-200 hover:bg-[#F1F3EA] px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مشاركة الإنجاز</span>
                      </button>
                    </div>
                  </div>

                  {/* Phase 4C: Achievement Counter & "أفكاري المحفوظة" Toggle Banner */}
                  <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 p-3 rounded-2xl border border-[#E6D9B8]/80 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#D8C69A] text-[#626B49] font-black flex items-center justify-center text-sm shadow-inner shrink-0">
                        🏆
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-gray-900">إنجازات تدابير التوفير:</span>
                          <span className="bg-[#626B49] text-white text-[10px] font-black px-2 py-0.2 rounded-full">
                            {calculateUniqueAchievementCount(triedTipIds)} حيل مُجربة
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 block">
                          {triedTipIds.length > 0
                            ? `عاش! جربت ${calculateUniqueAchievementCount(triedTipIds)} حيل ووفرت في بيتك`
                            : 'اضغط "جربت الحيلة دي ووفرت" لحساب إنجازاتك'}
                        </span>
                      </div>
                    </div>

                    {/* Toggle between All Tips and "أفكاري المحفوظة" */}
                    <button
                      type="button"
                      onClick={() => setDailyTipsViewMode(prev => prev === 'saved' ? 'all' : 'saved')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 border shrink-0 ${
                        dailyTipsViewMode === 'saved'
                          ? 'bg-[#626B49] text-white border-[#626B49] shadow-xs'
                          : 'bg-white text-[#626B49] border-[#DCE2D0] hover:bg-[#F1F3EA]'
                      }`}
                      title="عرض الحيل التي حفظتها للرجوع إليها"
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${dailyTipsViewMode === 'saved' ? 'fill-white' : ''}`} />
                      <span>أفكاري المحفوظة ({savedTipIds.length})</span>
                    </button>
                  </div>

                  {/* Search and Category Filter */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={dailySearch}
                        onChange={(e) => setDailySearch(e.target.value)}
                        placeholder="ابحث في أفكار التوفير والمنزل..."
                        className="w-full text-xs bg-white border border-gray-200 rounded-xl py-2 px-3 pl-8 focus:outline-none focus:border-[#626B49]"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                    </div>

                    {/* Active Saved Mode Indicator */}
                    {dailyTipsViewMode === 'saved' && (
                      <div className="bg-[#F1F3EA] border border-[#DCE2D0] rounded-xl px-3 py-1.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-[#626B49] flex items-center gap-1">
                          <Bookmark className="w-3.5 h-3.5 fill-[#626B49]" />
                          <span>عرض أفكاري المحفوظة ({filteredDailyIdeas.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setDailyTipsViewMode('all')}
                          className="text-[11px] font-bold text-gray-600 hover:text-[#626B49] underline"
                        >
                          عرض كل الحيل
                        </button>
                      </div>
                    )}

                    {/* Phase 4C: 5 Exact Categories (الكل، تنظيف، توفير كهرباء، مطبخ وتغذية، حيل تسوق) */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                      {['الكل', 'تنظيف', 'توفير كهرباء', 'مطبخ وتغذية', 'حيل تسوق'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedDailyCategory(cat)}
                          className={`px-3 py-1 rounded-xl whitespace-nowrap font-bold transition ${
                            selectedDailyCategory === cat
                              ? 'bg-[#626B49] text-white shadow-xs'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Curated Tips List */}
                  <div className="space-y-3">
                    {filteredDailyIdeas.length === 0 ? (
                      <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-[#F1F3EA] text-[#626B49] mx-auto flex items-center justify-center font-bold text-lg">
                          💡
                        </div>
                        <p className="text-xs font-bold text-gray-800">
                          {dailyTipsViewMode === 'saved'
                            ? 'لسه مفيش حيل محفوظة. احفظ أي تدبيرة عجبتك علشان ترجع لها وقت ما تحتاجها.'
                            : 'لا توجد حيل مطابقة لهذا التصنيف حالياً. اختر تصنيفاً آخر أو اضغط "الكل".'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setDailyTipsViewMode('all');
                            setSelectedDailyCategory('الكل');
                            setDailySearch('');
                          }}
                          className="text-xs font-bold text-[#626B49] bg-[#F1F3EA] hover:bg-[#E8EBDD] px-3 py-1.5 rounded-xl transition"
                        >
                          عرض كل الحيل 💡
                        </button>
                      </div>
                    ) : (
                      filteredDailyIdeas.map(idea => {
                        const isSaved = savedTipIds.includes(idea.id);
                        const isTried = triedTipIds.includes(idea.id);
                        const isBrokenImg = brokenImages[idea.id];

                        return (
                          <div key={idea.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-2.5">
                            {/* Visual Banner */}
                            <div className="relative h-28 w-full bg-gray-100 overflow-hidden">
                              {!isBrokenImg ? (
                                <img
                                  src={idea.imageUrl}
                                  alt={idea.title}
                                  onError={() => handleImageError(idea.id)}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                  <SvgIllustration type={idea.svgIcon} className="w-20 h-20" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                              <span className="absolute top-2 right-2 bg-black/50 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                {idea.category}
                              </span>
                              <span className="absolute bottom-2 right-2 text-white font-bold text-xs drop-shadow-xs">
                                ⏱️ {idea.timeRequired}
                              </span>
                            </div>

                            <div className="p-3.5 pt-0 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-sm text-gray-900 leading-snug">{idea.title}</h4>
                                {isTried && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>مُجربة</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed">{idea.description}</p>

                              <div className="bg-[#F1F3EA]/70 p-2 rounded-xl text-[11px] text-[#626B49] flex items-center gap-1.5">
                                <span>💡</span>
                                <span className="font-medium">{idea.practicalTip}</span>
                              </div>

                              {/* Tags display */}
                              <div className="flex flex-wrap gap-1 text-[10px] text-gray-500 pt-0.5">
                                {idea.tags.map((tag, tIdx) => (
                                  <span key={tIdx} className="bg-gray-100 px-1.5 py-0.2 rounded text-gray-600">
                                    #{tag}
                                  </span>
                                ))}
                              </div>

                              {/* Interactive Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-1.5">
                                {/* Phase 4C: Interactive "جربت الحيلة دي ووفرت" Button */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleTriedTip(idea.id)}
                                  className={`text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition ${
                                    isTried
                                      ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-300'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  }`}
                                  title="سجل أنك طبقت هذه الحيلة في بيتك"
                                >
                                  {isTried ? <Check className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />}
                                  <span>{isTried ? 'جربتها بالفعل ✓' : 'جربت الحيلة دي ووفرت'}</span>
                                </button>

                                <div className="flex items-center gap-1">
                                  {/* Bookmark Control */}
                                  <button
                                    type="button"
                                    onClick={() => toggleSaveTip(idea.id)}
                                    className={`text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition border ${
                                      isSaved
                                        ? 'bg-[#EFE5C8] text-[#765B3A] border-amber-300'
                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                                    }`}
                                    title="حفظ في أفكاري المحفوظة"
                                  >
                                    <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-600 text-amber-600' : ''}`} />
                                    <span>{isSaved ? 'محفوظة' : 'حفظ'}</span>
                                  </button>

                                  {/* Share Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleShareTip(idea)}
                                    className="text-xs font-bold text-[#626B49] hover:bg-[#F1F3EA] px-2.5 py-1.5 rounded-xl border border-gray-200 flex items-center gap-1 transition"
                                    title="مشاركة النصيحة"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* === TAB 4: التسوق وقائمة النواقص === */}
              {/* ======================================================== */}
              {activeTab === 'saved' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#1E5631]">التسوق وقائمة النواقص 🛒</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      طلبات السوق والنواقص المحفوظة بدون إنترنت مع روابط مباشرة لمتاجر السوبرماركت.
                    </p>
                  </div>

                  {/* Reliable, Transparent Shopping List Interface (No NaN Ever) */}
                    <div className="space-y-3">
                      {/* Financial Grand Total Banner */}
                      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm space-y-2.5">
                        <ShoppingTotalsSummary totals={shoppingTotals} items={shoppingItems} />

                      </div>

                        {/* Feature 1: WhatsApp Sharing Action */}
                        <button
                          onClick={handleShareShoppingWhatsApp}
                          className="w-full min-h-[44px] bg-[#1E5631] hover:bg-[#2E7D32] text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631]"
                          title="مشاركة الأصناف غير المشتراة عبر تطبيق واتساب"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>مشاركة قائمة النواقص عبر واتساب</span>
                        </button>

                        {/* Direct Store / Grocery Quick-Links */}
                        <div className="bg-[#F5F0E5]/90 p-3.5 rounded-2xl border border-[#E4DECF] shadow-sm space-y-3">
                          <div className="border-b border-[#E4DECF] pb-2.5">
                            <div className="flex items-center gap-1.5">
                              <ShoppingCart className="w-4 h-4 text-[#1E5631] shrink-0" />
                              <h3 className="text-xs font-extrabold text-[#1E5631]">🛒 اطلب نواقصك من المتجر</h3>
                            </div>
                            <p className="mt-1 text-[11px] text-[#5C5548] leading-relaxed">
                              {shoppingItems.some(i => !i.isChecked)
                                ? `عندك ${shoppingItems.filter(i => !i.isChecked).length} أصناف ناقصة — افتح قسم السوبرماركت في المتجر مباشرة لطلبها بسهولة.`
                                : 'روابط مباشرة لأشهر متاجر السوبرماركت والبقالة في مصر لتصفح العروض اليومية.'}
                            </p>
                          </div>

                          <div className="space-y-2.5">
                            {matchDealsForShoppingItems(shoppingItems.length).map(deal => {
                              const hasMissing = shoppingItems.some(i => !i.isChecked);
                              return (
                                <div key={deal.id} className="bg-white p-3 rounded-xl border border-[#E6DFCE] shadow-xs space-y-2.5">
                                  <div>
                                    <span className="block font-extrabold text-xs text-gray-900">{deal.partnerName}</span>
                                    <p className="text-[11px] text-[#5C5548] mt-1 leading-relaxed">{deal.description}</p>
                                  </div>

                                  <a
                                    href={deal.affiliateTrackingUrl || deal.officialUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full min-h-[44px] bg-[#1E5631] hover:bg-[#2E7D32] text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631]"
                                  >
                                    <span>{hasMissing ? `اطلب النواقص من ${deal.shortName}` : `تصفح عروض ${deal.shortName}`}</span>
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                  </a>
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-0.5 text-center">
                            <p className="text-[10px] text-[#6E675A] leading-relaxed">
                              روابط مباشرة للمواقع الرسمية للمتاجر — قد يحصل تطبيق تدبيرة على عمولة بسيطة لدعم استمرار التطوير المجاني.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                          <button
                            onClick={() => {
                              setNewItemName('');
                              setNewItemQty('1');
                              setNewItemUnit('حبة');
                              setNewItemUnitPrice('');
                              setIsAddItemModalOpen(true);
                            }}
                            className="min-h-[40px] bg-[#1E5631] hover:bg-[#2E7D32] text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة طلب جديد</span>
                          </button>

                          <div className="flex gap-1.5">
                            {shoppingItems.some(i => i.isChecked) && (
                              <button
                                onClick={() => {
                                  setShoppingItems(prev => prev.filter(i => !i.isChecked));
                                  showToast('تم مسح الأصناف المشتراة');
                                }}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                              >
                                مسح المكتمل
                              </button>
                            )}
                            {shoppingItems.length > 0 && (
                              <button
                                onClick={() => setIsClearShoppingConfirmOpen(true)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                              >
                                إفراغ القائمة
                              </button>
                            )}
                          </div>
                        </div>

                      {/* Empty State */}
                      {shoppingItems.length === 0 ? (
                        <div className="bg-white p-8 rounded-3xl text-center border border-dashed border-gray-300 space-y-3">
                          <div className="w-14 h-14 bg-[#F1F3EA] text-[#626B49] rounded-full mx-auto flex items-center justify-center shadow-inner">
                            <ShoppingCart className="w-7 h-7" />
                          </div>
                          <h4 className="text-base font-extrabold text-gray-800">
                            لا توجد نواقص حاليًا.. دولاب خزينك تمام! 🧺
                          </h4>
                          <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
                            تقدر تضيف طلبات بالضغط على زر "إضافة طلب جديد" أو من أي وصفة تختارها في تدبيرة الأكل لنقل النواقص تلقائياً.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {shoppingItems.map(item => {
                            const lineTotal = calculateLineTotal(item.quantity, item.unitPrice);

                            return (
                              <div
                                key={item.id}
                                className={`p-3 rounded-2xl border transition ${
                                  item.isChecked
                                    ? 'bg-gray-50/70 border-gray-200 opacity-70'
                                    : 'bg-white border-gray-200 shadow-xs'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  {/* Checkbox & Item Name */}
                                  <div
                                    onClick={() => {
                                      setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i));
                                    }}
                                    className="flex items-center gap-2.5 cursor-pointer flex-1"
                                  >
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                                      item.isChecked ? 'bg-[#626B49] border-[#626B49] text-white' : 'border-gray-300 bg-white'
                                    }`}>
                                      {item.isChecked && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                    <div>
                                      <span className={`text-xs font-bold ${item.isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                        {item.name}
                                      </span>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {item.unitPrice !== null ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingPriceItem({
                                                id: item.id,
                                                name: item.name,
                                                currentPrice: item.unitPrice !== null ? item.unitPrice.toString() : ''
                                              });
                                            }}
                                            className="text-[10px] text-gray-500 hover:text-[#626B49] flex items-center gap-0.5"
                                            title="اضغط لتعديل سعر الوحدة"
                                          >
                                            <span>سعر الوحدة: {item.unitPrice} ج.م</span>
                                            <Edit3 className="w-2.5 h-2.5 text-gray-400" />
                                          </button>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingPriceItem({
                                                id: item.id,
                                                name: item.name,
                                                currentPrice: ''
                                              });
                                            }}
                                            className="text-[10px] text-amber-700 font-bold bg-[#F7F0DE] hover:bg-[#EFE5C8] px-1.5 py-0.5 rounded border border-[#E6D9B8] flex items-center gap-1"
                                          >
                                            <span>السعر غير محدد</span>
                                            <span className="text-[#626B49] underline">حدد السعر</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quantity Stepper & Line Total */}
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                                      <button
                                        onClick={() => updateItemQty(item.id, -0.5)}
                                        className="w-5 h-5 rounded text-gray-600 hover:bg-gray-200 font-bold flex items-center justify-center text-xs"
                                        title="إنقاص الكمية"
                                      >
                                        -
                                      </button>
                                      <span className="px-1.5 text-xs font-bold text-gray-800">
                                        {item.quantity} {item.unit}
                                      </span>
                                      <button
                                        onClick={() => updateItemQty(item.id, 0.5)}
                                        className="w-5 h-5 rounded text-gray-600 hover:bg-gray-200 font-bold flex items-center justify-center text-xs"
                                        title="زيادة الكمية"
                                      >
                                        +
                                      </button>
                                    </div>

                                    {/* Line Total Display (Never NaN) */}
                                    <div className="text-left min-w-[65px]">
                                      {lineTotal !== null ? (
                                        <span className="font-black text-xs text-[#626B49] block">
                                          {Math.round(lineTotal)} ج.م
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-amber-700 bg-[#F7F0DE] px-1.5 py-0.5 rounded block">
                                          غير مسعر
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => setShoppingItems(prev => prev.filter(i => i.id !== item.id))}
                                      className="text-gray-400 hover:text-red-600 p-1"
                                      title="حذف"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                </div>
              )}

            </div>

            {/* ======================================================== */}
            {/* GOOGLE ADMOB BANNER (Dedicated Container Above Bottom Nav) */}
            {/* ======================================================== */}
            <div
              className={`transition-all duration-300 ease-in-out border-t border-gray-200 bg-white shrink-0 ${
                adStatus === 'failed' || adStatus === 'disabled'
                  ? 'h-0 py-0 border-transparent opacity-0 overflow-hidden'
                  : 'h-[72px] py-1 px-3 flex flex-col justify-center'
              }`}
            >
              <div className="w-full max-w-2xl mx-auto">
                {/* Policy Header Bar: Clear 'إعلان' Tag & Non-Deceptive Separation */}
                <div className="flex items-center justify-between text-[10px] pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="bg-gray-200 text-gray-700 font-bold px-1.5 py-0.2 rounded text-[9px]">
                      إعلان
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium truncate max-w-[190px]">
                      {IS_DEV ? 'AdMob Test • 320x50' : 'Google AdMob'}
                    </span>
                  </div>
                  {IS_DEV && (
                    <button
                      onClick={() => setIsAdControlsOpen(true)}
                      className="text-[9px] text-[#626B49] font-bold hover:underline"
                    >
                      اختبار الحالة ⚙️
                    </button>
                  )}
                </div>

                {/* Banner Area (Fixed 50px Height Reservation) */}
                <div className="h-[50px] w-full rounded-lg overflow-hidden relative">
                  {adStatus === 'loaded' && (
                    <div className="h-full w-full bg-gradient-to-r from-[#F1F5EC] via-amber-50 to-[#EEF1E8] border border-[#DCE2D0]/80 rounded-lg flex items-center justify-between px-3 text-xs select-none shadow-inner">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-[#626B49] text-[#D8C69A] font-black text-[10px] flex items-center justify-center shrink-0">
                          Ad
                        </div>
                        <div>
                          <span className="font-extrabold text-[#626B49] block leading-tight text-[11px]">
                            Google AdMob • Test Ad
                          </span>
                          <span className="text-[10px] text-gray-600 block leading-tight">
                            تدبيرة مصر: وفّر في ميزانية بيتك مع بدائل الأكل الذكية
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold bg-amber-200/80 text-[#765B3A] px-2 py-0.5 rounded-full shrink-0">
                        Sample Unit
                      </span>
                    </div>
                  )}

                  {adStatus === 'loading' && (
                    <div className="h-full w-full bg-gray-100 border border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 px-3 text-xs animate-pulse">
                      <div className="w-4 h-4 border-2 border-[#626B49] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        جارِ حجز المساحة وتحميل إعلان AdMob...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <nav className="tadbeera-bottom-nav bg-[#FFFEFA] border-t border-[#E8E0D1] pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shrink-0 shadow-[0_-5px_20px_rgba(83,75,54,0.06)]" aria-label="التنقل الرئيسي">
              <div className="w-full max-w-2xl mx-auto px-1.5 grid grid-cols-5">
                {([
                  { id: 'home', label: 'الرئيسية', Icon: Home },
                  { id: 'food', label: 'المطبخ', Icon: Utensils },
                  { id: 'saved', label: 'التسوق', Icon: ShoppingCart },
                  { id: 'budget', label: 'الميزانية', Icon: Wallet },
                  { id: 'household', label: 'البيت', Icon: Users }
                ] as const).map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id || (id === 'home' && activeTab === 'daily') ? 'page' : undefined}
                    className={activeTab === id || (id === 'home' && activeTab === 'daily') ? "flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[#5F7651] bg-[#EEF1E8] font-extrabold" : "flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[#999487]"}>
                    <Icon className="w-5 h-5" strokeWidth={activeTab === id || (id === 'home' && activeTab === 'daily') ? 2.5 : 1.9} />
                    <span className="text-[10px] leading-4">{label}</span>
                  </button>
                ))}
              </div>
            </nav>

      </main>

      {/* ======================================================== */}
      {/* ---------------- MODAL 1: RECIPE DETAILS ---------------- */}
      {/* ======================================================== */}
      {selectedRecipeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold text-[#626B49]">{selectedRecipeModal.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>⏱️ {selectedRecipeModal.prepTimeMinutes} دقيقة</span>
                  <span>•</span>
                  <span className="text-[#626B49] font-bold">
                    💵 ~{getScaledCost(selectedRecipeModal)} ج.م ({familySize} أفراد)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleSaveRecipe(selectedRecipeModal.id)}
                  aria-label={savedRecipeIds.includes(selectedRecipeModal.id) ? 'إزالة من المحفوظات' : 'حفظ الوصفة'}
                  title={savedRecipeIds.includes(selectedRecipeModal.id) ? 'إزالة من المحفوظات' : 'حفظ الوصفة'}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                    savedRecipeIds.includes(selectedRecipeModal.id)
                      ? 'border-[#D8C69A] bg-[#F7F0DE] text-[#765B3A]'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Bookmark className={`h-4 w-4 ${savedRecipeIds.includes(selectedRecipeModal.id) ? 'fill-[#765B3A]' : ''}`} />
                </button>
                <button
                  onClick={() => setSelectedRecipeModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                  aria-label="إغلاق"
                >
                  ✕
                </button>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              🏷️ تكلفة تقديرية وغير ملزمة محسوبة لـ {familySize} أفراد تختلف حسب الأسعار الموسمية بالأسواق المصرية.
            </p>

            {/* Ingredients Scaled */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-xs text-gray-800">المكونات المطلوبة (لـ {familySize} أفراد):</h4>
                <span className="text-[10px] text-gray-400">كميات دقيقة</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-2">
                {selectedRecipeModal.ingredients.map((ing, i) => {
                  const isAvailable = selectedIngredients.some(sel => ing.name.includes(sel) || sel.includes(ing.name));
                  const scaled = getScaledIngredient(ing, selectedRecipeModal.baseServings);

                  return (
                    <li key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col items-start gap-1">
                          <span className={isAvailable ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            {isAvailable ? '✓' : '✗'}
                          </span>
                          <span className="font-bold text-gray-900">{ing.name}</span>
                          <span className="text-xs font-semibold text-[#626B49] bg-[#F1F3EA] px-2 py-1 rounded-lg">{scaled.text}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-[#EFE5C8] text-amber-800'
                        }`}>
                          {isAvailable ? 'متوفر' : 'ناقص'}
                        </span>
                      </div>

                      {/* Practical Alternative Suggestion if missing */}
                      {!isAvailable && ing.alternatives && ing.alternatives.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-200/60 text-[11px] text-gray-600 bg-[#F7F0DE]/60 p-1.5 rounded-lg">
                          <span className="font-bold text-[#765B3A]">بديل عملي مقترح: </span>
                          <span className="font-bold text-gray-900">{ing.alternatives[0].name}</span>
                          <p className="text-[10px] text-gray-500 mt-0.5">{ing.alternatives[0].impact}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Cooking Steps */}
            <div>
              <h4 className="font-bold text-xs text-gray-800 mb-2">طريقة التحضير خطوة بخطوة:</h4>
              <div className="space-y-2.5">
                {selectedRecipeModal.steps.map((st, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-[#E4DECF] bg-[#F1F3EA]/50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#626B49] text-xs font-extrabold text-white">{['١','٢','٣','٤','٥','٦','٧','٨','٩','١٠'][i] || String(i + 1)}</span>
                    <p className="min-w-0 flex-1 text-sm leading-7 font-medium text-gray-800">{st}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const missing = selectedRecipeModal.ingredients.filter(ing =>
                    !selectedIngredients.some(sel => ing.name.includes(sel) || sel.includes(ing.name))
                  );
                  handleAddMissingToShopping(missing, selectedRecipeModal.baseServings);
                  setSelectedRecipeModal(null);
                }}
                className="flex-1 bg-white border border-[#626B49] text-[#626B49] font-bold py-2.5 rounded-xl text-xs hover:bg-[#F1F3EA] transition flex items-center justify-center gap-1"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>إضافة النواقص لقائمة المشتريات</span>
              </button>
              <button
                onClick={() => setSelectedRecipeModal(null)}
                className="bg-[#626B49] text-white font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                تمام، فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------------- MODAL 2: ADD SHOPPING ITEM ------------- */}
      {/* ======================================================== */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-extrabold text-[#626B49]">إضافة طلب لقائمة النواقص</h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">اسم الصنف:</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="مثال: جبنة قريش، عدس، عيش بلدي"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">الكمية:</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="1"
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">الوحدة:</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                  >
                    <option value="حبة">حبة</option>
                    <option value="كيلو">كيلو</option>
                    <option value="جرام">جرام</option>
                    <option value="كوب">كوب</option>
                    <option value="علبة">علبة</option>
                    <option value="كيس">كيس</option>
                    <option value="رغيف">رغيف</option>
                    <option value="لتر">لتر</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-700 font-bold">سعر الوحدة التقديري (بالجنيه):</label>
                  <span className="text-[10px] text-gray-400">اختياري - اتركه فارغاً إذا كان غير محدد</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newItemUnitPrice}
                  onChange={(e) => setNewItemUnitPrice(e.target.value)}
                  placeholder="مثال: 15 (أو اتركه فارغاً)"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (newItemName.trim()) {
                    const parsedQty = parseSafeQuantity(newItemQty);
                    const parsedPrice = parseSafePrice(newItemUnitPrice); // Returns null if empty string

                    setShoppingItems(prev => [
                      ...prev,
                      {
                        id: Math.random().toString(36).substring(2, 9),
                        name: newItemName.trim(),
                        quantity: parsedQty,
                        unit: newItemUnit.trim() || 'حبة',
                        unitPrice: parsedPrice,
                        isChecked: false
                      }
                    ]);
                    setNewItemName('');
                    setNewItemQty('1');
                    setNewItemUnitPrice('');
                    setIsAddItemModalOpen(false);
                    showToast('تمت إضافة الصنف بنجاح 🛒');
                  } else {
                    showToast('يرجى إدخال اسم الصنف أولاً');
                  }
                }}
                className="flex-1 bg-[#626B49] text-white font-bold py-2 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                إضافة للقائمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------- MODAL 2.5: EDIT ITEM UNIT PRICE ----------- */}
      {/* ======================================================== */}
      {editingPriceItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#626B49]">تحديد سعر الوحدة</h3>
              <button onClick={() => setEditingPriceItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              صنف: <span className="font-bold text-gray-900">{editingPriceItem.name}</span>
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">سعر الوحدة بالجنيه المصري:</label>
              <input
                type="number"
                min="0"
                step="0.5"
                autoFocus
                value={editingPriceItem.currentPrice}
                onChange={(e) => setEditingPriceItem({ ...editingPriceItem, currentPrice: e.target.value })}
                placeholder="مثال: 20 (أو امسحه ليكون غير مسعر)"
                className="w-full border border-gray-300 rounded-xl p-2.5 font-bold text-[#626B49] focus:outline-none focus:border-[#626B49]"
              />
              <span className="text-[10px] text-gray-400 block">إذا تركت الحقل فارغاً سيعتبر الصنف غير محدد السعر.</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingPriceItem(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveItemPrice}
                className="flex-1 bg-[#626B49] text-white font-bold py-2 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                حفظ السعر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------------- MODAL 3: ADD EXPENSE RECORD ----------- */}
      {/* ======================================================== */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-extrabold text-[#626B49]">تسجيل مصروف جديد</h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">المبلغ المدفوع (ج.م):</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="مثال: 120"
                  className="w-full border border-gray-300 rounded-xl p-2.5 font-bold text-[#626B49] focus:outline-none focus:border-[#626B49]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">بند المصروف:</label>
                <select
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">البيان / الوصف:</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="مثال: خضار وسوق الأسبوع، فاتورة مياه"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">تاريخ الصرف:</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddExpense}
                className="flex-1 bg-[#626B49] text-white font-bold py-2 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                تسجيل وحفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------------- MODAL 4: ADD CUSTOM CATEGORY --------- */}
      {/* ======================================================== */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-extrabold text-[#626B49]">إضافة بند ميزانية مخصص</h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">اسم البند:</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: دروس خصوصية، علاج وصيدلية"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">نصيحة أو تفاصيل البند:</label>
                <input
                  type="text"
                  value={newCatTip}
                  onChange={(e) => setNewCatTip(e.target.value)}
                  placeholder="مثال: مصروفات كتب خارجية واشتراكات المدارس"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddCustomCategory}
                className="flex-1 bg-[#626B49] text-white font-bold py-2 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                إضافة وإعادة ضبط 100%
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------- MODAL 4.5: PAYDAY DATE CONFIGURATION -------- */}
      {/* ======================================================== */}
      {isPaydayModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2 text-[#626B49]">
                <Calendar className="w-5 h-5 text-[#D8C69A]" />
                <h3 className="text-base font-extrabold">تحديد موعد الراتب الشهري</h3>
              </div>
              <button onClick={() => setIsPaydayModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600 leading-relaxed">
                اختر يوم نزول راتبك الشهري (من يوم 1 إلى 31). سيقوم التطبيق بحساب الأيام المتبقية تلقائياً وتحديد الحد اليومي المقترح للصرف حتى موعد الراتب القادم.
              </p>

              <div>
                <label className="block text-gray-700 font-bold mb-1">يوم صرف الراتب (1 - 31):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={tempPaydayInput}
                    onChange={(e) => setTempPaydayInput(e.target.value)}
                    className="flex-1 text-center font-black text-lg text-[#626B49] border border-gray-300 rounded-xl p-2 focus:outline-none focus:border-[#626B49]"
                    placeholder="25"
                  />
                  <span className="text-xs font-bold text-gray-500">من كل شهر</span>
                </div>
                <span className="text-[10px] text-gray-400 block mt-1">
                  * في الشهور الأقصر (مثل فبراير 28 أو أبريل 30 يوماً)، يتم استخدام آخر يوم في الشهر تلقائياً.
                </span>
              </div>

              {/* Quick Day Chips */}
              <div>
                <span className="text-[11px] font-bold text-gray-600 block mb-1.5">أيام شائعة:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 5, 20, 25, 27, 28, 30].map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setTempPaydayInput(day.toString())}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        tempPaydayInput === day.toString()
                          ? 'bg-[#626B49] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      يوم {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsPaydayModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  const parsed = parseInt(tempPaydayInput, 10);
                  if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) {
                    setPaydayDay(parsed);
                    setIsPaydayModalOpen(false);
                    showToast(`تم حفظ موعد الراتب: يوم ${parsed} من كل شهر 📅`);
                  } else {
                    showToast('يرجى إدخال يوم صالح بين 1 و 31');
                  }
                }}
                className="flex-1 bg-[#626B49] text-white font-bold py-2.5 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                حفظ الموعد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------------- MODAL 5: SETTINGS & BACKUPS ---------- */}
      {/* ======================================================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2 text-[#626B49]">
                <Settings className="w-5 h-5" />
                <h3 className="text-base font-extrabold">إعدادات التطبيق والبيانات</h3>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            {/* Household profile: saved locally and available offline */}
            <div className="space-y-2 rounded-2xl border border-[#E4DECF] bg-[#F1F3EA]/50 p-3">
              <div className="flex items-center gap-2 text-[#626B49]">
                <Users className="w-4 h-4" />
                <span className="text-xs font-extrabold">بيانات الأسرة</span>
                <span className="mr-auto text-[10px] text-gray-500">محفوظة على جهازك</span>
              </div>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="اسم الأسرة (اختياري)"
                maxLength={60}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#626B49]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={householdGovernorate}
                  onChange={(e) => setHouseholdGovernorate(e.target.value)}
                  placeholder="المحافظة"
                  maxLength={40}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#626B49]"
                />
                <input
                  type="text"
                  value={householdCity}
                  onChange={(e) => setHouseholdCity(e.target.value)}
                  placeholder="المدينة / المركز"
                  maxLength={40}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#626B49]"
                />
              </div>
              <div className="text-[10px] text-gray-600">عدد أفراد الأسرة: {familySize} · العملة: جنيه مصري</div>
              <button
                type="button"
                onClick={() => {
                  const saved = householdProfileRepository.write({
                    name: householdName.trim(),
                    familySize: Math.min(30, Math.max(1, familySize)),
                    governorate: householdGovernorate.trim(),
                    city: householdCity.trim(),
                    currency: 'EGP',
                    locale: 'ar-EG',
                    paydayDay,
                    createdAt: householdProfileRepository.read().createdAt || new Date().toISOString()
                  });
                  showToast(saved ? 'تم حفظ بيانات الأسرة على هذا الجهاز ✓' : 'تعذر حفظ البيانات. تحققي من مساحة التخزين بالجهاز.');
                }}
                className="w-full rounded-xl bg-[#626B49] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1E5631]"
              >
                حفظ بيانات الأسرة
              </button>
            </div>

            {/* Backups & Data Management */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 block">النسخ الاحتياطي والاستعادة:</span>

              <button
                onClick={handleExportData}
                className="w-full bg-[#F1F3EA] hover:bg-[#E8EBDD] text-[#626B49] font-bold p-2.5 rounded-xl text-xs flex items-center justify-between transition border border-[#DCE2D0]"
              >
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-[#626B49]" />
                  <span>تصدير نسخة احتياطية (JSON)</span>
                </div>
                <span className="text-[10px] text-gray-500">تحميل ملف</span>
              </button>

              <label className="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold p-2.5 rounded-xl text-xs flex items-center justify-between transition border border-gray-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-gray-600" />
                  <span>استعادة نسخة احتياطية (Import JSON)</span>
                </div>
                <span className="text-[10px] text-gray-500">رفع ملف</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Safe Data Clear Options */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-700 block">تنظيف ومسح البيانات:</span>

              <button
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setIsClearShoppingConfirmOpen(true);
                }}
                className="w-full text-right bg-[#F7F0DE] hover:bg-[#EFE5C8] text-[#765B3A] font-bold p-2.5 rounded-xl text-xs flex items-center justify-between transition border border-[#E6D9B8]"
              >
                <span>إفراغ قائمة النواقص فقط</span>
                <Trash2 className="w-4 h-4 text-amber-700" />
              </button>

              <button
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setIsWipeModalOpen(true);
                }}
                className="w-full text-right bg-red-50 hover:bg-red-100 text-red-700 font-bold p-2.5 rounded-xl text-xs flex items-center justify-between transition border border-red-200"
              >
                <span>إعادة ضبط المصنع (مسح كل بيانات التطبيق)</span>
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </button>
            </div>

            {/* AdMob Diagnostics in Settings (Development Only) */}
            {IS_DEV && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-700 block">إعلانات جوجل أد موب (Google AdMob):</span>
                <button
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    setIsAdControlsOpen(true);
                  }}
                  className="w-full bg-[#F7F0DE] hover:bg-[#EFE5C8] text-amber-950 font-bold p-2.5 rounded-xl text-xs flex items-center justify-between transition border border-[#E6D9B8]"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>لوحة ضبط ومحاكاة الإعلانات (وضع التطوير)</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/80 text-[#765B3A] px-2 py-0.5 rounded-md font-extrabold">
                    {adStatus === 'loaded' ? 'البانر نشط' : adStatus === 'loading' ? 'تحميل...' : adStatus === 'failed' ? 'منهار (أوفلاين)' : 'معطل'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* -------- MODAL 5.5: CONFIRM RESTORE BACKUP ------------ */}
      {/* ======================================================== */}
      {isRestoreConfirmModalOpen && pendingRestoreData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600 border-b border-gray-100 pb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-extrabold text-gray-900">تأكيد استعادة النسخة الاحتياطية</h3>
            </div>

            <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
              <p className="font-semibold text-gray-800">
                هل تريد استبدال بيانات التطبيق الحالية بهذه النسخة؟
              </p>
              <div className="bg-[#F7F0DE] text-[#765B3A] p-2.5 rounded-xl border border-[#E6D9B8] text-[11px] leading-relaxed">
                ⚠️ تنبيه: سيتم استبدال الميزانية والمصاريف وقوائم النواقص الحالية بالبيانات المحفوظة في ملف النسخة الاحتياطية.
              </div>

              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">حجم الأسرة:</span>
                  <span className="font-bold text-[#626B49]">{pendingRestoreData.familySize} أفراد</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">مبلغ الميزانية:</span>
                  <span className="font-bold text-[#626B49]">{pendingRestoreData.budgetAmount} ج.م</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">عدد بنود النواقص:</span>
                  <span className="font-bold text-gray-800">{pendingRestoreData.shoppingItems.length} طلب</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">عدد المصاريف المسجلة:</span>
                  <span className="font-bold text-gray-800">{pendingRestoreData.expenses.length} مصروف</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">الوجبات المحفوظة:</span>
                  <span className="font-bold text-gray-800">{pendingRestoreData.savedRecipeIds.length} وجبة</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setIsRestoreConfirmModalOpen(false);
                  setPendingRestoreData(null);
                }}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmRestore}
                className="flex-1 bg-[#626B49] hover:bg-[#1E5631] text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm"
              >
                تأكيد الاستعادة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------------- MODAL 6: CLEAR SHOPPING CONFIRM ------- */}
      {/* ======================================================== */}
      {isClearShoppingConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-extrabold text-[#765B3A]">إفراغ قائمة النواقص؟</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              سيتم حذف جميع الأصناف المسجلة في قائمة النواقص حالياً. الوجبات وخطط الميزانية والمصاريف ستظل محفوظة ولن تتأثر.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsClearShoppingConfirmOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleClearShoppingList}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-xl text-xs transition"
              >
                تأكيد الإفراغ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------------- MODAL 7: WIPE ALL DATA CONFIRM -------- */}
      {/* ======================================================== */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-extrabold">مسح جميع بيانات التطبيق نهائياً؟</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              هذا الإجراء سيقوم بحذف جميع الوجبات المحفوظة، خطط الميزانية، سجل المصاريف، وتحديات الأيام وقوائم النواقص نهائياً من ذاكرة جهازك. لا يمكن التراجع عن هذا الإجراء إلا إذا كنت قد حمّلت نسخة احتياطية (JSON).
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsWipeModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleWipeAllData}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition"
              >
                مسح جميع البيانات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------- MODAL 8: ADMOB SIMULATION CONTROLS (Development Only) ---------- */}
      {/* ======================================================== */}
      {IS_DEV && isAdControlsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2 text-[#626B49]">
                <Sparkles className="w-5 h-5 text-[#D8C69A]" />
                <h3 className="text-base font-extrabold">لوحة تحكم إعلانات Google AdMob</h3>
              </div>
              <button onClick={() => setIsAdControlsOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            {/* Banner Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 block">إعلان البانر (320x50 Banner):</span>
                <span className="text-[10px] text-gray-400">حجز مساحة 50px • انهيار سلس</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                يتم حجز مساحة ثابتة (50px) للبانر فوق شريط التنقل السفلي مباشرة لمنع اهتزاز الشاشة (CLS). في حال انقطاع الشبكة أو فشل التحميل، تنهار الحاوية تلقائياً لاسترجاع المساحة دون ترك فراغ ميت.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => { setAdStatus('loaded'); showToast('تم تفعيل البانر (Loaded) ✓'); }}
                  className={`p-2 rounded-xl text-center font-bold text-xs transition border ${
                    adStatus === 'loaded' ? 'bg-[#626B49] text-white border-[#626B49]' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  🟢 محمّل (Loaded)
                </button>
                <button
                  onClick={() => { setAdStatus('loading'); showToast('محاكاة التحميل وحجز المساحة ⏳'); }}
                  className={`p-2 rounded-xl text-center font-bold text-xs transition border ${
                    adStatus === 'loading' ? 'bg-[#D97706] text-white border-[#D97706] animate-pulse' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  ⏳ تحميل (Reserve Space)
                </button>
                <button
                  onClick={() => { setAdStatus('failed'); showToast('محاكاة فشل التحميل وانهيار الحاوية 📉'); }}
                  className={`p-2 rounded-xl text-center font-bold text-xs transition border ${
                    adStatus === 'failed' ? 'bg-rose-600 text-white border-rose-600' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  🔴 فشل (Collapse to 0)
                </button>
                <button
                  onClick={() => { setAdStatus('disabled'); showToast('تم تعطيل البانر 🚫'); }}
                  className={`p-2 rounded-xl text-center font-bold text-xs transition border ${
                    adStatus === 'disabled' ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  ⚪ معطل (Hidden)
                </button>
              </div>
            </div>

            {/* Interstitial Section */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-800 block">الإعلانات البينية (Interstitial Ads Policy):</span>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-[11px] text-gray-600 space-y-1">
                <div>• <b>معطلة افتراضياً:</b> لا تظهر إلا بتفعيل يدوي صريح.</div>
                <div>• <b>تحديد التكرار:</b> حد أقصى مرتان في الجلسة ({sessionInterstitialCount}/2).</div>
                <div>• <b>فترة راحة (Cooldown):</b> 120 ثانية بين كل إعلان والآخر.</div>
                <div>• <b>حماية المهام:</b> محظورة أثناء حساب الميزانية أو إدخال الأسعار.</div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInterstitialEnabled}
                    onChange={(e) => {
                      setIsInterstitialEnabled(e.target.checked);
                      showToast(e.target.checked ? 'تم تفعيل الإعلانات البينية ⚡' : 'تم تعطيل الإعلانات البينية 🛡️');
                    }}
                    className="w-4 h-4 text-[#626B49] rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800">تفعيل الإعلانات البينية</span>
                </label>

                <button
                  onClick={triggerTestInterstitial}
                  className="bg-[#626B49] hover:bg-[#1E5631] text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-sm"
                >
                  اختبار العرض الآن 🎬
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsAdControlsOpen(false)}
                className="w-full bg-[#626B49] text-white font-bold py-2 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                إغلاق اللوحة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------- MODAL 9: INTERSTITIAL AD SIMULATION (Development Only) --------- */}
      {/* ======================================================== */}
      {IS_DEV && isInterstitialActive && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col space-y-0 animate-in fade-in zoom-in-95 duration-200">
            {/* Ad Top Bar */}
            <div className="bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2">
                <span className="bg-yellow-400 text-gray-900 font-extrabold px-1.5 py-0.2 rounded text-[10px]">
                  AdMob Test
                </span>
                <span className="text-[11px] text-gray-300">Google Mobile Ads • Interstitial</span>
              </div>
              <button
                onClick={handleDismissInterstitial}
                className="w-6 h-6 rounded-full bg-gray-800 hover:bg-gray-700 text-white font-black flex items-center justify-center transition"
                title="إغلاق الإعلان"
              >
                ✕
              </button>
            </div>

            {/* Ad Body Content */}
            <div className="p-6 bg-gradient-to-b from-[#F1F5EC] to-white flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#626B49] text-[#D8C69A] font-black flex items-center justify-center text-2xl shadow-lg">
                تد
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 block mb-1">
                  Unit: ca-app-pub-3940256099942544/1033173712
                </span>
                <h3 className="text-lg font-black text-[#626B49]">تدبيرة مصر – Tedbeera Egypt</h3>
                <p className="text-xs text-gray-600 mt-1 max-w-[240px]">
                  تطبيق مصري ذكي لتوفير ميزانية الأسرة، أكلات التوفير، وبدائل المكونات بدون إنترنت!
                </p>
              </div>

              {/* Policy Guard Verification Badge */}
              <div className="w-full bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-right text-[11px] space-y-1 text-emerald-900">
                <div className="font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم فحص معايير سياسة Google AdMob:</span>
                </div>
                <div className="text-[10px] text-gray-600">
                  • ظهور عند انتقال طبيعي فقط (غير مفاجئ)<br />
                  • التكرار: {sessionInterstitialCount + 1} من 2 كحد أقصى للجلسة<br />
                  • تم تفعيل مؤقت راحة إلزامي 120 ثانية للإعلان القادم
                </div>
              </div>

              <div className="w-full pt-2">
                <button
                  onClick={handleDismissInterstitial}
                  className="w-full bg-[#626B49] hover:bg-[#1E5631] text-white font-extrabold py-3 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>استئناف واستخدام تدبيرة</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ---------- MODAL 10: REWARDED AD SIMULATION DIALOG ----- */}
      {/* ======================================================== */}
      {isRewardSimulationOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col space-y-0 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#626B49] text-white px-4 py-3 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <span className="bg-[#D8C69A] text-[#626B49] font-extrabold px-1.5 py-0.2 rounded text-[10px]">
                  AdMob Test
                </span>
                <span className="text-xs font-bold">Google Mobile Ads • Rewarded Ad</span>
              </div>
              <button
                onClick={handleCancelRewardSimulation}
                className="w-6 h-6 rounded-full bg-[#4B5337]/90 hover:bg-[#3A412A] text-white font-black flex items-center justify-center transition text-xs"
                title="إلغاء الإعلان"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#EFE5C8] text-[#765B3A] flex items-center justify-center shadow-sm">
                <CalendarCheck className="w-7 h-7 text-[#626B49]" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[#626B49]">فتح خطة الوجبات التوفيرية</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  جرّب محاكاة الإعلان لفتح خطة وجبات الأسبوع الكاملة مع جدول التسوق المجمع.
                </p>
              </div>

              {/* Simulation Environment Notice */}
              <div className="w-full bg-[#F7F0DE] border border-[#E6D9B8] p-2.5 rounded-xl text-right text-[11px] space-y-1 text-amber-950">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>محاكاة تجريبية مخصصة للمعاينة:</span>
                </div>
                <div className="text-[10px] text-gray-600 space-y-0.5">
                  <div>• <b>معرف الوحدة التجريبية:</b> {OFFICIAL_TEST_REWARDED_AD_UNIT}</div>
                  <div>• هذه محاكاة واجهة تجريبية وليست إعلاناً حقيقياً من Google.</div>
                  <div>• تمنح المكافأة فقط عند اكتمال المشاهدة بالكامل.</div>
                </div>
              </div>

              {/* Playback Sequence or Action Buttons */}
              {!isSimulatingPlayback ? (
                <div className="w-full space-y-2 pt-1">
                  <button
                    onClick={handleStartSimulationPlayback}
                    className="w-full bg-[#626B49] hover:bg-[#1E5631] text-white font-extrabold py-3 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>ابدأ المحاكاة (5 ثوانٍ)</span>
                  </button>
                  <button
                    onClick={handleCancelRewardSimulation}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-xs transition"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#626B49] flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 animate-pulse text-[#D8C69A]" />
                        <span>جارِ محاكاة تشغيل الإعلان...</span>
                      </span>
                      <span className="font-mono font-bold text-gray-700">{playbackCountdown} ثانية</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#626B49] h-full transition-all duration-1000 ease-linear rounded-full"
                        style={{ width: `${((5 - playbackCountdown) / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCancelRewardSimulation}
                    className="w-full text-xs text-rose-600 hover:text-rose-800 font-bold py-1.5 transition"
                  >
                    تخطي وإلغاء (بدون مكافأة) ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ------- MODAL 11: CONSOLIDATED WEEKLY SHOPPING PLAN ---- */}
      {/* ======================================================== */}
      {isConsolidatedShoppingModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between border-b border-gray-100 pb-2">
              <div>
                <h3 className="text-base font-extrabold text-[#626B49] flex items-center gap-1.5">
                  <CalendarCheck className="w-5 h-5 text-[#D8C69A]" />
                  <span>جدول التسوق المجمع لخطة الأسبوع</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  مقادير مجمعة ومحسوبة لـ {familySize} أفراد لجميع أيام الأسبوع (السبت - الجمعة).
                </p>
              </div>
              <button
                onClick={() => setIsConsolidatedShoppingModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Total Estimated Cost Banner */}
            {(() => {
              const consolidated = consolidateWeeklyPlanIngredients(familySize);
              const totalEst = consolidated.reduce((sum, item) => sum + item.totalEstimatedCost, 0);

              return (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-900 block">إجمالي تقديري لمشتريات الأسبوع:</span>
                      <span className="text-[10px] text-emerald-700">لكل وجبات الفطار والغداء والعشاء لـ {familySize} أفراد</span>
                    </div>
                    <span className="text-base font-extrabold text-emerald-800">
                      ~{totalEst} ج.م
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-gray-800 block">الأصناف المجمعة ({consolidated.length} صنف):</span>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {consolidated.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-gray-900 block">{item.name}</span>
                            <span className="text-[10px] text-gray-500">
                              تُستخدم في {item.usedInMealsCount} وجبات طوال الأسبوع
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-[#626B49] block">
                              {item.quantity} {item.unit}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              ~{item.totalEstimatedCost} ج.م
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => setIsConsolidatedShoppingModalOpen(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition"
                    >
                      إغلاق
                    </button>
                    <button
                      onClick={handleAddConsolidatedPlanToShopping}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>+ إضافة الأصناف لقائمة النواقص</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* ------- MODAL 12: ADD CUSTOM RECIPE (أضف أكلتك الخاصة) --- */}
      {/* ======================================================== */}
      {isAddCustomRecipeModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-extrabold text-[#626B49]">أضف أكلتك الخاصة 🍳</h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">اسم الوجبة:</label>
                <input
                  type="text"
                  value={customRecipeName}
                  onChange={(e) => setCustomRecipeName(e.target.value)}
                  placeholder="مثال: مسقعة باللحمة المفرومة"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">التصنيف:</label>
                <select
                  value={customRecipeMealType}
                  onChange={(e) => setCustomRecipeMealType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                >
                  <option value="breakfast">فطار 🍳</option>
                  <option value="lunch">غداء 🍲</option>
                  <option value="dinner">عشاء 🌙</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">الوقت (بالدقائق):</label>
                  <input
                    type="number"
                    value={customRecipePrepTime}
                    onChange={(e) => setCustomRecipePrepTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">التكلفة (ج.م):</label>
                  <input
                    type="number"
                    value={customRecipeCost}
                    onChange={(e) => setCustomRecipeCost(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">المكون الأساسي:</label>
                <input
                  type="text"
                  value={customRecipeIngredientName}
                  onChange={(e) => setCustomRecipeIngredientName(e.target.value)}
                  placeholder="مثال: باذنجان، لحمة مفرومة، طماطم"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:border-[#626B49]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsAddCustomRecipeModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCustomRecipe}
                className="flex-1 bg-[#626B49] text-white font-bold py-2 rounded-xl text-xs hover:bg-[#1E5631] transition"
              >
                حفظ وإضافة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
