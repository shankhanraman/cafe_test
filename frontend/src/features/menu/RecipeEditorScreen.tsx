import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../app/app-context';
import {
  useListMenu,
  useGetMenuRecipe,
  useSetMenuRecipe,
  getGetMenuRecipeQueryKey,
} from '../../api/generated/menu/menu';
import { useListInventory } from '../../api/generated/inventory/inventory';
import type { OrderSize } from '../../api/generated/model/orderSize';
import type { RecipeLine } from '../../api/generated/model/recipeLine';
import { ApiError } from '../../api/http-client';
import { Card, Button, money } from '../../components/ui';
import { meta, price } from '../../lib/display';
import { IconArrowLeft, IconPlus, IconX } from '../../lib/icons';

const SIZES: OrderSize[] = ['LESS', 'REGULAR', 'SERVING'];

export function RecipeEditorScreen() {
  const { nav, params, showToast } = useApp();
  const qc = useQueryClient();
  const menu = (useListMenu().data?.data ?? []).filter((m) => m.type === 'MADE');
  const inventory = useListInventory().data?.data ?? [];
  const [selId, setSelId] = useState<string>((params.menuId as string) || menu[0]?.id || '');
  const [size, setSize] = useState<OrderSize>('REGULAR');
  const [lines, setLines] = useState<RecipeLine[]>([]);

  const sel = menu.find((m) => m.id === selId) ?? menu[0];
  const effectiveId = sel?.id ?? '';

  // Load the recipe for the selected MADE item — exercises GET /api/menu/{id}/recipe.
  const recipeQuery = useGetMenuRecipe(effectiveId, { query: { enabled: !!effectiveId } });
  const setRecipe = useSetMenuRecipe();

  useEffect(() => {
    const res = recipeQuery.data;
    if (res?.status === 200) setLines(res.data.recipe ?? []);
  }, [recipeQuery.data]);

  const invOf = (id: string) => inventory.find((i) => i.id === id);
  const sizeLines = lines
    .map((l, idx) => ({ l, idx }))
    .filter(({ l }) => l.orderSize === size);

  const setQty = (idx: number, q: number) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: q } : l)));
  const setItem = (idx: number, inventoryItemId: string) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, inventoryItemId } : l)));
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));
  const addLine = () =>
    setLines((ls) => [...ls, { orderSize: size, inventoryItemId: inventory[0]?.id ?? '', quantity: 1 }]);

  const save = async () => {
    if (!sel) return;
    try {
      await setRecipe.mutateAsync({ id: sel.id, data: { lines } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['/api/menu'] }),
        qc.invalidateQueries({ queryKey: getGetMenuRecipeQueryKey(sel.id) }),
      ]);
      showToast({ title: 'Recipe saved', sub: sel.name });
    } catch (e) {
      showToast({ title: 'Could not save recipe', sub: e instanceof ApiError ? e.problem?.detail || e.message : 'Unexpected error' });
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <button onClick={() => nav('menu')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
        <IconArrowLeft size={15} /> Back to menu
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', gap: 20, alignItems: 'start' }}>
        <Card style={{ padding: 8 }}>
          {menu.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelId(m.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                border: '1px solid', borderColor: m.id === sel?.id ? 'var(--pine-700)' : 'transparent',
                background: m.id === sel?.id ? 'var(--pine-tint)' : 'transparent', cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
              <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{meta(m.id).hi}</div>
            </button>
          ))}
        </Card>

        {sel && (
          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="display" style={{ fontWeight: 700, fontSize: 19 }}>{sel.name}</div>
                <div className="dvn" style={{ fontSize: 13, color: 'var(--faint)' }}>{meta(sel.id).hi} · {new Set(lines.map((r) => r.inventoryItemId)).size} ingredients</div>
              </div>
              <span className="mono" style={{ fontWeight: 600 }}>{money(price(sel.id))}</span>
            </div>

            <div style={{ display: 'flex', gap: 4, background: 'var(--divider)', borderRadius: 9, padding: 3, width: 'fit-content', marginBottom: 8 }}>
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  style={{ padding: '6px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: size === s ? 'var(--card)' : 'transparent', color: size === s ? 'var(--pine-700)' : 'var(--muted)', boxShadow: size === s ? 'var(--shadow-card)' : 'none' }}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14 }}>Selling one {size.toLowerCase()} deducts each of these from stock.</div>

            <div style={{ border: '1px solid var(--divider)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: 12, padding: '10px 14px', background: 'var(--surface)', fontSize: 12, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <div>Ingredient</div><div>Per order</div><div>Available</div><div />
              </div>
              {recipeQuery.isLoading && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13.5 }}>Loading recipe…</div>}
              {!recipeQuery.isLoading && sizeLines.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13.5 }}>No ingredients for this size yet.</div>}
              {sizeLines.map(({ l, idx }) => {
                const it = invOf(l.inventoryItemId);
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: 12, padding: '11px 14px', borderTop: '1px solid var(--divider)', alignItems: 'center' }}>
                    <select aria-label="Ingredient" value={l.inventoryItemId} onChange={(e) => setItem(idx, e.target.value)} style={cellInput}>
                      {inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input aria-label="Per order quantity" type="number" min={0} value={l.quantity} onChange={(e) => setQty(idx, Number(e.target.value) || 0)} style={cellInput} />
                    <div className="mono" style={{ fontSize: 13.5, color: 'var(--muted)' }}>{it?.quantityOnHand ?? '—'} {it?.unit ?? ''}</div>
                    <button aria-label="Remove ingredient" onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: 'var(--flag)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconX size={16} /></button>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <Button variant="ghost" disabled={inventory.length === 0} onClick={addLine}><IconPlus size={15} /> Add ingredient</Button>
              <Button disabled={setRecipe.isPending} onClick={save}>Save recipe</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

const cellInput: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13.5 };
