import { Sparkles } from 'lucide-react';
import type { ShoppingItem, ShoppingTotals } from '../../data/calculationUtils';

interface ShoppingTotalsSummaryProps {
  totals: ShoppingTotals;
  items: ShoppingItem[];
  isFetchingPrices?: boolean;
}

/** Displays priced and pending shopping totals without owning or mutating app state. */
export function ShoppingTotalsSummary({ totals, items, isFetchingPrices }: ShoppingTotalsSummaryProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] text-[#8E757C] block">
            {totals.isFullyPriced ? 'إجمالي النواقص التقديري:' : 'مجموع الأصناف المسعرة حتى الآن:'}
          </span>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-black text-[#C96D84] tabular-nums">
              {totals.knownTotal} جنيه مصري
            </span>
            {!totals.isFullyPriced && (
              <span className="bg-[#D9AE72]/20 text-[#4A353B] text-[10px] font-bold px-2 py-0.5 rounded-lg border border-[#D9AE72]/45 tabular-nums">
                {isFetchingPrices
                  ? 'جاري التحقق من الأسعار...'
                  : `${totals.unpricedCount} أصناف تنتظر السعر`}
              </span>
            )}
          </div>
          {!totals.isFullyPriced && (
            <p className="text-[10px] text-[#8E757C] mt-0.5">
              * سيتم استكمال الإجمالي فور جلب أسعار السوق الحقيقية أو إدخال السعر يدوياً.
            </p>
          )}
        </div>

        <div className="text-left shrink-0">
          <span className="text-[10px] text-[#8E757C] block">المتبقي للشراء:</span>
          <span className="text-sm font-black text-[#C96D84] tabular-nums">
            {totals.pendingKnownTotal} ج.م
          </span>
        </div>
      </div>

      {items.length > 0 && items.every(item => item.isChecked) && (
        <div className="clay-card-cream border border-[#A8B8A0]/55 text-[#4A353B] p-3 text-xs font-extrabold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#A8B8A0] shrink-0" />
          <span>🎉 شطبت كل طلباتك ووفرت صح!</span>
        </div>
      )}
    </>
  );
}
