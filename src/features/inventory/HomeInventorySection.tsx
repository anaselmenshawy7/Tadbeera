import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Shopping3DIcon } from '../../components/Tadbeera3DIcons';
import { inventoryRepository } from './inventoryRepository';
import { getLowStockItems, getExpiringInventoryItems, type InventoryItem, type InventoryUnit } from './inventoryModels';
import {
  fetchRealEgyptMarketPrice,
  getAllVerifiedEgyptPrices,
  lookupEgypt2026MarketPrice,
  normalizeMarketItemKey,
  purgeStalePriceCaches,
  revalidateVerifiedPriceCache,
  saveVerifiedEgyptPrice,
  VERIFIED_PRICES_UPDATED_EVENT,
  type VerifiedEgyptPriceRecord,
} from '../../services/egyptMarketPriceService';

const units: InventoryUnit[] = ['قطعة', 'كيلو', 'جرام', 'لتر', 'عبوة', 'علبة', 'رغيف'];

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export interface HomeInventorySectionProps {
  onAddLowStockToShopping?: (item: { name: string; unit: string; quantity: number }) => void;
}

export function HomeInventorySection({ onAddLowStockToShopping }: HomeInventorySectionProps) {
  const [items, setItems] = useState<InventoryItem[]>(() => inventoryRepository.read());
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemMin, setItemMin] = useState('1');
  const [itemExpiry, setItemExpiry] = useState('');
  const [itemUnit, setItemUnit] = useState<InventoryUnit>('قطعة');
  const [verifiedPrices, setVerifiedPrices] = useState<Record<string, VerifiedEgyptPriceRecord>>(() => {
    purgeStalePriceCaches();
    revalidateVerifiedPriceCache();
    return getAllVerifiedEgyptPrices();
  });
  const [fetchingKeys, setFetchingKeys] = useState<Record<string, boolean>>({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const attemptedLookupKeysRef = useRef<Set<string>>(new Set());

  const persistItems = (next: InventoryItem[]) => {
    setItems(next);
    inventoryRepository.write(next);
  };

  useEffect(() => {
    const syncPrices = () => setVerifiedPrices(getAllVerifiedEgyptPrices());
    if (typeof window !== 'undefined') {
      window.addEventListener(VERIFIED_PRICES_UPDATED_EVENT, syncPrices);
      return () => window.removeEventListener(VERIFIED_PRICES_UPDATED_EVENT, syncPrices);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const uncached = items.filter(item => {
      const key = normalizeMarketItemKey(item.name, item.unit);
      return !verifiedPrices[key] && !attemptedLookupKeysRef.current.has(key);
    });
    if (uncached.length === 0) return;

    let cancelled = false;
    uncached.forEach(item => {
      const key = normalizeMarketItemKey(item.name, item.unit);
      attemptedLookupKeysRef.current.add(key);
      setFetchingKeys(prev => ({ ...prev, [key]: true }));
      void fetchRealEgyptMarketPrice(item.name, item.unit)
        .then(record => {
          if (!cancelled && record) {
            setVerifiedPrices(getAllVerifiedEgyptPrices());
          }
        })
        .finally(() => {
          if (!cancelled) {
            setFetchingKeys(prev => {
              const copy = { ...prev };
              delete copy[key];
              return copy;
            });
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [items, verifiedPrices]);

  const lowStock = useMemo(() => getLowStockItems(items), [items]);
  const expiring = useMemo(() => getExpiringInventoryItems(items, 7), [items]);
  const expired = useMemo(
    () => items.filter(item => item.expiresOn !== null && item.expiresOn < todayKey()),
    [items]
  );

  const addItem = () => {
    const name = itemName.trim();
    const quantity = Number(itemQty);
    const minimumQuantity = Number(itemMin);
    if (!name || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(minimumQuantity) || minimumQuantity < 0) {
      return;
    }
    persistItems([
      ...items,
      {
        id: crypto.randomUUID(),
        name,
        quantity,
        unit: itemUnit,
        minimumQuantity,
        updatedAt: new Date().toISOString(),
        expiresOn: itemExpiry || null,
      },
    ]);
    setItemName('');
    setItemQty('1');
    setItemMin('1');
    setItemExpiry('');
  };

  const updateItem = (id: string, patch: Partial<InventoryItem>) =>
    persistItems(items.map(item => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)));

  const sendToShopping = (item: InventoryItem) => {
    if (!onAddLowStockToShopping) return;
    const neededQty = Math.max(1, Math.ceil(item.minimumQuantity - item.quantity) || 1);
    onAddLowStockToShopping({
      name: item.name,
      unit: item.unit,
      quantity: neededQty,
    });
  };

  const handleSavePantryPrice = (item: InventoryItem) => {
    const parsed = Number.parseFloat(priceDraft.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    saveVerifiedEgyptPrice({
      itemName: item.name,
      unit: item.unit,
      typicalPrice: parsed,
      source: 'user_verified',
      sourceLabel: 'سعرك المسجل',
    });
    setVerifiedPrices(getAllVerifiedEgyptPrices());
    setEditingPriceId(null);
    setPriceDraft('');
  };

  const handleFetchSinglePantryPrice = async (item: InventoryItem) => {
    const key = normalizeMarketItemKey(item.name, item.unit);
    setFetchingKeys(prev => ({ ...prev, [key]: true }));
    try {
      const result = await fetchRealEgyptMarketPrice(item.name, item.unit);
      if (result) {
        setVerifiedPrices(getAllVerifiedEgyptPrices());
        if (editingPriceId === item.id) {
          setPriceDraft(String(result.typicalPrice));
        }
      }
    } finally {
      setFetchingKeys(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  return (
    <section className="clay-card p-4 space-y-3 overflow-x-hidden" dir="rtl" aria-label="مخزون البيت">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="clay-icon-well w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
            <Shopping3DIcon className="w-7 h-7" />
          </span>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm text-[#4A353B]">مخزون البيت 🧺</h3>
            <p className="text-[11px] text-[#8E757C] mt-0.5">تابعي الكميات في البيت وضِيفي النواقص لقائمة السوق بضغطة واحدة.</p>
          </div>
        </div>
        <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl tabular-nums shrink-0 border ${
          lowStock.length > 0
            ? 'bg-[#D9AE72]/20 border-[#D9AE72]/45 text-[#4A353B]'
            : 'bg-[#A8B8A0]/25 border-[#A8B8A0]/45 text-[#4A353B]'
        }`}>
          نواقص: {lowStock.length}
        </span>
      </div>

      {(lowStock.length > 0 || expiring.length > 0 || expired.length > 0) && (
        <div className="clay-card-cream border border-[#D9AE72]/45 p-3 text-[11px] text-[#4A353B] space-y-1.5">
          {lowStock.length > 0 && <p>⚠️ أصناف وصلت للحد الأدنى: {lowStock.map(x => x.name).join('، ')}</p>}
          {expiring.length > 0 && <p>⏳ أصناف تنتهي خلال 7 أيام: {expiring.map(x => x.name).join('، ')}</p>}
          {expired.length > 0 && <p className="font-bold text-red-700">⛔ أصناف منتهية الصلاحية: {expired.map(x => x.name).join('، ')}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          value={itemName}
          onChange={e => setItemName(e.target.value)}
          placeholder="اسم الصنف (مثال: رز، زيت)"
          maxLength={60}
          className="clay-inset text-[#4A353B] p-2.5 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
        />
        <input
          value={itemQty}
          onChange={e => setItemQty(e.target.value)}
          type="number"
          min="0"
          step="0.1"
          placeholder="الكمية الحالية"
          className="clay-inset text-[#4A353B] p-2.5 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
        />
        <input
          value={itemMin}
          onChange={e => setItemMin(e.target.value)}
          type="number"
          min="0"
          step="0.1"
          placeholder="حد التنبيه"
          className="clay-inset text-[#4A353B] p-2.5 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
        />
        <select
          value={itemUnit}
          onChange={e => setItemUnit(e.target.value as InventoryUnit)}
          className="clay-inset text-[#4A353B] p-2.5 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
        >
          {units.map(unit => <option key={unit}>{unit}</option>)}
        </select>
        <label className="col-span-2 text-[11px] text-[#8E757C] font-semibold">
          تاريخ الصلاحية (اختياري)
          <input
            type="date"
            value={itemExpiry}
            onChange={e => setItemExpiry(e.target.value)}
            className="clay-inset mt-1 block w-full text-[#4A353B] p-2.5 text-xs focus:outline-none focus:border-[#D47E93]"
          />
        </label>
        <button
          type="button"
          onClick={addItem}
          className="clay-btn-primary col-span-2 min-h-[42px] text-xs font-extrabold p-2.5"
        >
          إضافة للمخزون
        </button>
      </div>

      {items.length === 0 ? (
        <div className="clay-card-cream p-3 text-xs text-[#8E757C] text-center">لسه مفيش أصناف في المخزون.</div>
      ) : (
        <div className="space-y-2.5">
          {items.map(item => {
            const isLow = item.quantity <= item.minimumQuantity;
            const priceKey = normalizeMarketItemKey(item.name, item.unit);
            const verified = verifiedPrices[priceKey] || lookupEgypt2026MarketPrice(item.name, item.unit);
            const isFetching = Boolean(fetchingKeys[priceKey]);
            const isEditingThisPrice = editingPriceId === item.id;

            return (
              <div key={item.id} className="clay-card-cream p-3 text-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <strong className="text-[#4A353B] block truncate">
                      {item.name} <span className="font-normal text-[#8E757C]">({item.quantity} {item.unit})</span>
                    </strong>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {isFetching ? (
                        <span className="inline-flex items-center gap-1 bg-[#FADDE4] text-[#C96D84] text-[10px] font-bold px-2 py-0.5 rounded-xl">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          جاري جلب السعر الحقيقي...
                        </span>
                      ) : verified ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceId(item.id);
                            setPriceDraft(String(verified.typicalPrice));
                          }}
                          className="clay-btn-secondary clay-tactile inline-flex items-center gap-1 text-[#C96D84] text-[10px] font-bold px-2.5 py-0.5 rounded-xl"
                        >
                          <span>{verified.typicalPrice} ج.م/{item.unit}</span>
                          <span className="text-[9px] text-[#8E757C]">
                            • {verified.source === 'live_market' ? 'مُحدّث من السوق' : 'سعرك المسجل'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceId(item.id);
                            setPriceDraft('');
                          }}
                          className="clay-btn-secondary clay-tactile inline-flex items-center gap-1 text-[#C96D84] text-[10px] font-bold px-2.5 py-0.5 rounded-xl"
                        >
                          أدخلي السعر +
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLow && onAddLowStockToShopping && (
                      <button
                        type="button"
                        onClick={() => sendToShopping(item)}
                        className="clay-btn-secondary clay-tactile min-h-[34px] rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-[#C96D84] whitespace-nowrap"
                      >
                        أضف للنواقص 🛒
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => persistItems(items.filter(x => x.id !== item.id))}
                      className="text-red-600 font-semibold px-1.5 py-1 rounded-lg hover:bg-red-50"
                    >
                      حذف
                    </button>
                  </div>
                </div>

                {isEditingThisPrice && (
                  <div className="clay-inset flex flex-wrap items-center gap-1.5 p-2">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={priceDraft}
                      onChange={e => setPriceDraft(e.target.value)}
                      placeholder={`سعر الـ ${item.unit} بالجنيه`}
                      className="flex-1 min-w-[110px] rounded-lg border border-[#F3DCE2] bg-white px-2 py-1 text-[11px] text-[#4A353B] focus:outline-none focus:border-[#D47E93]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSavePantryPrice(item)}
                      className="clay-btn-primary text-[10px] font-bold px-3 py-1.5"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleFetchSinglePantryPrice(item)}
                      disabled={isFetching}
                      className="clay-btn-secondary clay-tactile text-[#C96D84] text-[10px] font-bold px-2.5 py-1.5 inline-flex items-center gap-1 disabled:opacity-60"
                      title="جلب السعر الحقيقي من السوق المصري"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
                      <span>من السوق</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPriceId(null);
                        setPriceDraft('');
                      }}
                      className="rounded-lg text-[#8E757C] hover:text-[#4A353B] text-[10px] font-bold px-1.5 py-1"
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8E757C]">
                  <label className="flex items-center gap-1">
                    <span>الكمية</span>
                    <input
                      aria-label={'كمية ' + item.name}
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                      className="clay-inset w-16 bg-white text-[#4A353B] px-1.5 py-1 focus:outline-none focus:border-[#D47E93]"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span>حد التنبيه</span>
                    <input
                      aria-label={'حد التنبيه ' + item.name}
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.minimumQuantity}
                      onChange={e => updateItem(item.id, { minimumQuantity: Math.max(0, Number(e.target.value) || 0) })}
                      className="clay-inset w-16 bg-white text-[#4A353B] px-1.5 py-1 focus:outline-none focus:border-[#D47E93]"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span>الصلاحية</span>
                    <input
                      aria-label={'صلاحية ' + item.name}
                      type="date"
                      value={item.expiresOn || ''}
                      onChange={e => updateItem(item.id, { expiresOn: e.target.value || null })}
                      className="clay-inset bg-white text-[#4A353B] px-1.5 py-1 focus:outline-none focus:border-[#D47E93]"
                    />
                  </label>
                  {isLow && (
                    <span className="rounded-lg bg-[#D9AE72]/20 border border-[#D9AE72]/45 px-2 py-0.5 font-extrabold text-[#4A353B]">
                      ناقص عن الحد
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
