import { useMemo, useState } from 'react';
import { inventoryRepository } from '../inventory/inventoryRepository';
import { getLowStockItems, getExpiringInventoryItems, type InventoryItem, type InventoryUnit } from '../inventory/inventoryModels';
import { householdTasksRepository } from './householdTaskRepository';
import { sortHouseholdTasks, type HouseholdTask } from './householdTaskModels';
import { savingsGoalsRepository } from '../savings/savingsRepository';
import { getSavingsProgress, type SavingsGoal } from '../savings/savingsModels';

const units: InventoryUnit[] = ['قطعة', 'كيلو', 'جرام', 'لتر', 'عبوة', 'علبة', 'رغيف'];
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export interface HouseholdHubProps {
  onAddLowStockToShopping?: (item: { name: string; unit: string; quantity: number }) => void;
  budgetSummary?: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
  };
  onOpenBudget?: () => void;
}

export function HouseholdHub({ onAddLowStockToShopping, budgetSummary, onOpenBudget }: HouseholdHubProps) {
  const [items, setItems] = useState<InventoryItem[]>(() => inventoryRepository.read());
  const [tasks, setTasks] = useState<HouseholdTask[]>(() => sortHouseholdTasks(householdTasksRepository.read()));
  const [goals, setGoals] = useState<SavingsGoal[]>(() => savingsGoalsRepository.read());
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemMin, setItemMin] = useState('1');
  const [itemExpiry, setItemExpiry] = useState('');
  const [itemUnit, setItemUnit] = useState<InventoryUnit>('قطعة');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [contributions, setContributions] = useState<Record<string, string>>({});

  const persistItems = (next: InventoryItem[]) => {
    setItems(next);
    inventoryRepository.write(next);
  };
  const persistTasks = (next: HouseholdTask[]) => {
    setTasks(sortHouseholdTasks(next));
    householdTasksRepository.write(next);
  };
  const persistGoals = (next: SavingsGoal[]) => {
    setGoals(next);
    savingsGoalsRepository.write(next);
  };

  const lowStock = useMemo(() => getLowStockItems(items), [items]);
  const expiring = useMemo(() => getExpiringInventoryItems(items, 7), [items]);
  const expired = useMemo(() => items.filter(item => item.expiresOn !== null && item.expiresOn < todayKey()), [items]);

  const addItem = () => {
    const name = itemName.trim();
    const quantity = Number(itemQty);
    const minimumQuantity = Number(itemMin);
    if (!name || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(minimumQuantity) || minimumQuantity < 0) return;
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

  const addTask = () => {
    const title = taskTitle.trim();
    if (!title) return;
    persistTasks([
      ...tasks,
      { id: crypto.randomUUID(), title, notes: '', dueDate: taskDue || null, completed: false, createdAt: new Date().toISOString() },
    ]);
    setTaskTitle('');
    setTaskDue('');
  };

  const addGoal = () => {
    const title = goalTitle.trim();
    const targetAmount = Number(goalTarget);
    if (!title || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
    persistGoals([
      ...goals,
      { id: crypto.randomUUID(), title, targetAmount, currentAmount: 0, targetDate: null, createdAt: new Date().toISOString() },
    ]);
    setGoalTitle('');
    setGoalTarget('');
  };

  const addContribution = (goal: SavingsGoal) => {
    const amount = Number(contributions[goal.id] || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    persistGoals(goals.map(g => (g.id === goal.id ? { ...g, currentAmount: g.currentAmount + amount } : g)));
    setContributions(prev => ({ ...prev, [goal.id]: '' }));
  };

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
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-[#DCE5D3] bg-[#F1F5EC] p-3.5">
        <h3 className="font-extrabold text-sm text-[#1E5631]">إدارة البيت 🏠</h3>
        <p className="mt-1 text-[11px] text-[#5C6650]">
          مخزون البيت، المهام اليومية، وأهداف التوفير — محفوظة محليًا وتعمل بدون إنترنت.
        </p>
      </div>

      {/* Pantry / Home Inventory */}
      <section className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-extrabold text-sm text-[#1E5631]">مخزون البيت 🧺</h4>
          <span className="text-[11px] font-bold text-[#765B3A] tabular-nums">
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
          <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="اسم الصنف" maxLength={60} className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]" />
          <input value={itemQty} onChange={e => setItemQty(e.target.value)} type="number" min="0" step="0.1" placeholder="الكمية الحالية" className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]" />
          <input value={itemMin} onChange={e => setItemMin(e.target.value)} type="number" min="0" step="0.1" placeholder="حد التنبيه" className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]" />
          <select value={itemUnit} onChange={e => setItemUnit(e.target.value as InventoryUnit)} className="rounded-xl border border-[#DDD5C3] p-2 text-xs bg-white focus:outline-none focus:border-[#1E5631]">
            {units.map(unit => <option key={unit}>{unit}</option>)}
          </select>
          <label className="col-span-2 text-[11px] text-gray-600">
            تاريخ الصلاحية (اختياري)
            <input type="date" value={itemExpiry} onChange={e => setItemExpiry(e.target.value)} className="mt-1 block w-full rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]" />
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
          <p className="text-xs text-gray-500">لسه مفيش أصناف في المخزون.</p>
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
                    <button type="button" onClick={() => persistItems(items.filter(x => x.id !== item.id))} className="text-red-600 font-semibold px-1">
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

      {/* Compact Read-Only Budget Summary linking to Tab 4 (الميزانية) */}
      {budgetSummary && (
        <section className="rounded-2xl border border-[#DDE5D8] bg-white p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-sm text-[#1E5631]">ملخص الميزانية الحالي 💳</h4>
              <p className="mt-0.5 text-[11px] text-[#665F52]">ملخص سريع لحالة الميزانية من قسم الميزانية</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
            <div className="rounded-xl bg-[#EEF6EE] p-2.5">
              <span className="block text-[10px] text-[#52715B]">الميزانية</span>
              <strong className="mt-1 block text-xs text-[#1E5631]">{budgetSummary.totalBudget.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div className="rounded-xl bg-[#FFF1EF] p-2.5">
              <span className="block text-[10px] text-[#9A5A50]">المصروف الفعلي</span>
              <strong className="mt-1 block text-xs text-[#9B3F35]">{budgetSummary.totalSpent.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div className="rounded-xl bg-[#F5F0E5] p-2.5">
              <span className="block text-[10px] text-[#68745B]">المتبقي</span>
              <strong className={`mt-1 block text-xs ${budgetSummary.totalRemaining >= 0 ? 'text-[#1E5631]' : 'text-[#9B3F35]'}`}>
                {budgetSummary.totalRemaining.toLocaleString('ar-EG')} ج.م
              </strong>
            </div>
          </div>

          {onOpenBudget && (
            <button
              type="button"
              onClick={onOpenBudget}
              className="w-full min-h-[42px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] text-white text-xs font-bold py-2.5 px-3 transition flex items-center justify-center"
            >
              إدارة الميزانية والمصاريف ←
            </button>
          )}
        </section>
      )}

      {/* Household Tasks */}
      <section className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-3 shadow-xs">
        <h4 className="font-extrabold text-sm text-[#1E5631]">مهام البيت ✅</h4>
        <div className="grid grid-cols-2 gap-2">
          <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="مثال: ترتيب المطبخ" maxLength={100} className="min-w-0 rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]" />
          <input type="date" value={taskDue} min={todayKey()} onChange={e => setTaskDue(e.target.value)} className="rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]" aria-label="موعد المهمة" />
        </div>
        <button type="button" onClick={addTask} className="w-full min-h-[40px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] p-2 text-xs font-bold text-white transition">
          إضافة مهمة
        </button>
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-500">أضف أول مهمة للبيت.</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 border-t border-[#EFE9DA] pt-2 text-xs">
              <input type="checkbox" checked={task.completed} onChange={e => persistTasks(tasks.map(t => (t.id === task.id ? { ...t, completed: e.target.checked } : t)))} />
              <span className={task.completed ? 'flex-1 text-gray-400 line-through' : 'flex-1'}>
                {task.title}
                <small className="block text-gray-400">{task.dueDate || 'بدون موعد'}</small>
              </span>
              <button type="button" onClick={() => persistTasks(tasks.filter(t => t.id !== task.id))} className="text-red-600 font-semibold">
                حذف
              </button>
            </div>
          ))
        )}
      </section>

      {/* Savings Goals */}
      <section className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-3 shadow-xs">
        <h4 className="font-extrabold text-sm text-[#1E5631]">أهداف التوفير 🪙</h4>
        <div className="grid grid-cols-2 gap-2">
          <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="اسم الهدف" maxLength={70} className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]" />
          <input value={goalTarget} onChange={e => setGoalTarget(e.target.value)} type="number" min="1" placeholder="المبلغ بالجنيه" className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]" />
        </div>
        <button type="button" onClick={addGoal} className="w-full min-h-[40px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] p-2 text-xs font-bold text-white transition">
          إنشاء هدف توفير
        </button>
        {goals.length === 0 ? (
          <p className="text-xs text-gray-500">حدد هدفًا مثل مصاريف المدرسة أو جهاز جديد.</p>
        ) : (
          goals.map(goal => {
            const progress = getSavingsProgress(goal);
            return (
              <div key={goal.id} className="space-y-2 border-t border-[#EFE9DA] pt-2">
                <div className="flex justify-between gap-2 text-xs tabular-nums">
                  <strong>{goal.title}</strong>
                  <span>
                    {Math.round(progress.saved)} / {goal.targetAmount} ج.م ({progress.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-[#2E7D32]" style={{ width: progress.percentage + '%' }} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={contributions[goal.id] || ''}
                    onChange={e => setContributions(prev => ({ ...prev, [goal.id]: e.target.value }))}
                    placeholder="إضافة مبلغ"
                    className="min-w-0 flex-1 rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]"
                  />
                  <button type="button" onClick={() => addContribution(goal)} className="min-h-[38px] rounded-xl bg-[#2E7D32] hover:bg-[#1E5631] px-3 text-xs font-bold text-white transition">
                    ادخار
                  </button>
                  <button type="button" onClick={() => persistGoals(goals.filter(g => g.id !== goal.id))} className="text-xs text-red-600 font-semibold px-1">
                    حذف
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

