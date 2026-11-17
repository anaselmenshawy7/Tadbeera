import { useMemo, useState } from 'react';
import { inventoryRepository } from './inventoryRepository';
import { getLowStockItems, getExpiringInventoryItems, type InventoryItem, type InventoryUnit } from './inventoryModels';

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

  const persistItems = (next: InventoryItem[]) => {
    setItems(next);
    inventoryRepository.write(next);
  };

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

  return (
    <section className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-3 shadow-xs" dir="rtl" aria-label="مخزون البيت">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-extrabold text-sm text-[#1E5631]">مخزون البيت 🧺</h3>
          <p className="text-[11px] text-[#6E675A] mt-0.5">تابعي الكميات في البيت وضِيفي النواقص لقائمة السوق بضغطة واحدة.</p>
        </div>
        <span className="text-[11px] font-bold text-[#765B3A] bg-[#F7F0DE] px-2.5 py-1 rounded-lg tabular-nums shrink-0">
          نواقص: {lowStock.length}
        </span>
      </div>

      {(lowStock.length > 0 || expiring.length > 0 || expired.length > 0) && (
        <div className="rounded-xl border border-[#E6D9B8] bg-[#F7F0DE] p-2.5 text-[11px] text-[#5E482D] space-y-1.5">
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
          className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]"
        />
        <input
          value={itemQty}
          onChange={e => setItemQty(e.target.value)}
          type="number"
          min="0"
          step="0.1"
          placeholder="الكمية الحالية"
          className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]"
        />
        <input
          value={itemMin}
          onChange={e => setItemMin(e.target.value)}
          type="number"
          min="0"
          step="0.1"
          placeholder="حد التنبيه"
          className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]"
        />
        <select
          value={itemUnit}
          onChange={e => setItemUnit(e.target.value as InventoryUnit)}
          className="rounded-xl border border-[#DDD5C3] p-2 text-xs bg-white focus:outline-none focus:border-[#1E5631]"
        >
          {units.map(unit => <option key={unit}>{unit}</option>)}
        </select>
        <label className="col-span-2 text-[11px] text-gray-600">
          تاريخ الصلاحية (اختياري)
          <input
            type="date"
            value={itemExpiry}
            onChange={e => setItemExpiry(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]"
          />
        </label>
        <button
          type="button"
          onClick={addItem}
          className="col-span-2 min-h-[40px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] text-white text-xs font-bold p-2 transition"
        >
          إضافة للمخزون
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">لسه مفيش أصناف في المخزون.</p>
      ) : (
        items.map(item => {
          const isLow = item.quantity <= item.minimumQuantity;
          return (
            <div key={item.id} className="border-t border-[#EFE9DA] pt-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-gray-900">
                  {item.name} <span className="font-normal text-gray-500">({item.quantity} {item.unit})</span>
                </strong>
                <div className="flex items-center gap-2 shrink-0">
                  {isLow && onAddLowStockToShopping && (
                    <button
                      type="button"
                      onClick={() => sendToShopping(item)}
                      className="min-h-[32px] rounded-lg border border-[#1E5631] bg-[#EEF6EE] hover:bg-[#1E5631] hover:text-white px-2.5 py-1 text-[11px] font-bold text-[#1E5631] transition whitespace-nowrap"
                    >
                      أضف للنواقص 🛒
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => persistItems(items.filter(x => x.id !== item.id))}
                    className="text-red-600 font-semibold px-1"
                  >
                    حذف
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600">
                <label>
                  الكمية{' '}
                  <input
                    aria-label={'كمية ' + item.name}
                    type="number"
                    min="0"
                    step="0.1"
                    value={item.quantity}
                    onChange={e => updateItem(item.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-16 rounded border border-[#DDD5C3] p-1"
                  />
                </label>
                <label>
                  حد التنبيه{' '}
                  <input
                    aria-label={'حد التنبيه ' + item.name}
                    type="number"
                    min="0"
                    step="0.1"
                    value={item.minimumQuantity}
                    onChange={e => updateItem(item.id, { minimumQuantity: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-16 rounded border border-[#DDD5C3] p-1"
                  />
                </label>
                <label>
                  الصلاحية{' '}
                  <input
                    aria-label={'صلاحية ' + item.name}
                    type="date"
                    value={item.expiresOn || ''}
                    onChange={e => updateItem(item.id, { expiresOn: e.target.value || null })}
                    className="rounded border border-[#DDD5C3] p-1"
                  />
                </label>
                {isLow && <span className="font-bold text-amber-700">ناقص عن الحد</span>}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
