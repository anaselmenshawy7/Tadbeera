import { PRIMARY_TABS, type ActiveTab } from '../app/navigation';
import { TadbeeraNav3DIcon } from './Tadbeera3DIcons';

export interface BottomNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tabId: ActiveTab) => void;
}

/**
 * Upgraded Soft-3D Claymorphism Bottom Navigation Bar.
 * Preserves the exact RTL tab order:
 * 1. الرئيسية
 * 2. المطبخ
 * 3. البيت
 * 4. التسوق
 * 5. الميزانية
 */
export function BottomNavigation({ activeTab, onSelectTab }: BottomNavigationProps) {
  return (
    <nav
      className="tadbeera-bottom-nav clay-nav-dock relative z-30 overflow-visible pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))] shrink-0"
      aria-label="التنقل الرئيسي"
    >
      <div className="w-full max-w-2xl mx-auto px-1.5 grid grid-cols-5 items-end gap-0.5">
        {PRIMARY_TABS.map(({ id, label }) => {
          const isActive = activeTab === id || (id === 'home' && activeTab === 'daily');

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`clay-tactile group relative flex min-h-[52px] flex-col items-center justify-end gap-0.5 rounded-2xl px-1 pb-1 pt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93] ${
                isActive
                  ? 'text-[#C96D84] font-extrabold'
                  : 'text-[#8E757C] font-semibold hover:text-[#4A353B]'
              }`}
            >
              {/* Soft Dusty-Rose Halo Backdrop behind active tab */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1 bottom-0.5 top-2 rounded-2xl bg-[#FADDE4]/70 border border-[#F3DCE2]"
                />
              )}

              {/* Elevated 3D Icon Shell (rises slightly above nav bar when active) */}
              <span
                className={`clay-nav-icon-shell relative z-10 flex h-8 w-8 items-center justify-center rounded-xl ${
                  isActive
                    ? 'clay-nav-icon-shell--active'
                    : 'clay-nav-icon-shell--inactive group-hover:bg-[#FADDE4]/40'
                }`}
              >
                <TadbeeraNav3DIcon
                  tabId={id}
                  active={isActive}
                  className="h-6 w-6"
                />
              </span>

              {/* Crisp RTL Arabic Label */}
              <span
                className={`relative z-10 text-[10px] leading-3.5 whitespace-nowrap ${
                  isActive ? 'text-[#C96D84] font-extrabold' : 'text-[#8E757C]'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
