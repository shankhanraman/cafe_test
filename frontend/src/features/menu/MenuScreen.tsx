import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../app/app-context';
import {
  useListMenu,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useGetMenuItem,
} from '../../api/generated/menu/menu';
import { useListInventory } from '../../api/generated/inventory/inventory';
import type { MenuResponse } from '../../api/generated/model/menuResponse';
import { Category } from '../../api/generated/model/category';
import { ApiError } from '../../api/http-client';
import { Card, Button, Badge, Pill, Modal, money } from '../../components/ui';
import { meta, price } from '../../lib/display';
import { IconPlus, IconEdit, IconChevronRight } from '../../lib/icons';

const CATEGORIES = Object.values(Category);

export function MenuScreen() {
  const { nav } = useApp();
  const menuQuery = useListMenu();
  const menu = useMemo(() => menuQuery.data?.data ?? [], [menuQuery.data]);
  const inventory = useListInventory().data?.data ?? [];
  const [cat, setCat] = useState<'All' | MenuResponse['category']>('All');
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null);

  const cats = useMemo(() => ['All', ...new Set(menu.map((m) => m.category))] as const, [menu]);
  const filtered = cat === 'All' ? menu : menu.filter((m) => m.category === cat);
  const invName = (id?: string | null) => inventory.find((i) => i.id === id)?.name ?? '—';

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Menu &amp; recipes</h1>
        <Button onClick={() => setForm({ mode: 'create' })}><IconPlus size={16} /> Add menu item</Button>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {cats.map((c) => (
          <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c === 'All' ? 'All' : pretty(c)}</Pill>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {filtered.map((m) => {
          const made = m.type === 'MADE';
          const ingredientCount = new Set((m.recipe ?? []).map((r) => r.inventoryItemId)).size;
          return (
            <Card key={m.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Badge tone={made ? 'confident' : 'resale'}>{made ? 'Made' : 'Resale'}</Badge>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{money(price(m.id))}</span>
                  <button aria-label={`Edit ${m.name}`} onClick={() => setForm({ mode: 'edit', id: m.id })} style={iconBtn}><IconEdit size={15} /></button>
                  <DeleteMenuButton item={m} />
                </div>
              </div>
              <div className="display" style={{ fontWeight: 600, fontSize: 16 }}>{m.name}</div>
              <div className="dvn" style={{ fontSize: 12.5, color: 'var(--faint)' }}>{meta(m.id).hi}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
                {made ? (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{ingredientCount} ingredients</span>
                    <button onClick={() => nav('recipe', { menuId: m.id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--pine-700)', fontWeight: 600, fontSize: 13 }}>
                      Edit recipe <IconChevronRight size={14} />
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>1:1 · {invName(m.resaleItemId)}</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {form && (
        <MenuFormModal
          mode={form.mode}
          id={form.mode === 'edit' ? form.id : undefined}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}

function DeleteMenuButton({ item }: { item: MenuResponse }) {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const del = useDeleteMenuItem();
  const remove = async () => {
    if (!window.confirm(`Delete menu item "${item.name}"?`)) return;
    try {
      await del.mutateAsync({ id: item.id });
      await qc.invalidateQueries({ queryKey: ['/api/menu'] });
      showToast({ title: 'Menu item deleted', sub: item.name });
    } catch (e) {
      showToast({ title: 'Could not delete menu item', sub: errMsg(e) });
    }
  };
  return (
    <button aria-label={`Delete ${item.name}`} onClick={remove} disabled={del.isPending} style={{ ...iconBtn, color: 'var(--flag)' }}>✕</button>
  );
}

function MenuFormModal({ mode, id, onClose }: { mode: 'create' | 'edit'; id?: string; onClose: () => void }) {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const create = useCreateMenuItem();
  const update = useUpdateMenuItem();
  const inventory = useListInventory().data?.data ?? [];
  // Load the current record by id when editing — exercises GET /api/menu/{id}.
  const existing = useGetMenuItem(id ?? '', { query: { enabled: mode === 'edit' && !!id } });

  const [name, setName] = useState('');
  const [type, setType] = useState<'MADE' | 'RESALE'>('MADE');
  const [category, setCategory] = useState<MenuResponse['category']>('TEA_COFFEE');
  const [resaleItemId, setResaleItemId] = useState('');

  useEffect(() => {
    const res = existing.data;
    if (mode === 'edit' && res?.status === 200) {
      const m = res.data;
      setName(m.name);
      setType(m.type);
      setCategory(m.category);
      setResaleItemId(m.resaleItemId ?? '');
    }
  }, [mode, existing.data]);

  const pending = create.isPending || update.isPending;
  const valid = name.trim() !== '' && (type === 'MADE' || resaleItemId !== '');

  const save = async () => {
    const data = {
      name: name.trim(),
      category,
      type,
      resaleItemId: type === 'RESALE' ? resaleItemId : null,
    };
    try {
      if (mode === 'edit' && id) await update.mutateAsync({ id, data });
      else await create.mutateAsync({ data });
      await qc.invalidateQueries({ queryKey: ['/api/menu'] });
      showToast({ title: mode === 'edit' ? 'Menu item updated' : 'Menu item added', sub: data.name });
      onClose();
    } catch (e) {
      showToast({ title: 'Could not save menu item', sub: errMsg(e) });
    }
  };

  const loading = mode === 'edit' && existing.isLoading;
  return (
    <Modal title={mode === 'edit' ? 'Edit menu item' : 'Add menu item'} width={460} onClose={onClose}>
      {loading ? (
        <div style={{ padding: 24, color: 'var(--faint)', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          <Label>Type</Label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Pill active={type === 'MADE'} onClick={() => setType('MADE')}>Made to order</Pill>
            <Pill active={type === 'RESALE'} onClick={() => setType('RESALE')}>Resale</Pill>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 12.5, marginBottom: 16, background: type === 'MADE' ? 'var(--confident-tint)' : 'var(--resale-tint)', color: type === 'MADE' ? 'var(--confident)' : 'var(--resale)' }}>
            {type === 'MADE'
              ? 'A recipe is required — edit ingredient lines per order size after saving.'
              : 'Links 1:1 to one inventory item and is sold as-is. No order size.'}
          </div>

          <Label>Name</Label>
          <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

          <div style={{ marginTop: 12 }}>
            <Label>Category</Label>
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as MenuResponse['category'])} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}
            </select>
          </div>

          {type === 'RESALE' && (
            <div style={{ marginTop: 12 }}>
              <Label>Linked inventory item</Label>
              <select aria-label="Linked inventory item" value={resaleItemId} onChange={(e) => setResaleItemId(e.target.value)} style={inputStyle}>
                <option value="">— Select an item —</option>
                {inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={!valid || pending} onClick={save}>{mode === 'edit' ? 'Save changes' : 'Add menu item'}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow" style={{ color: 'var(--faint)', marginBottom: 6 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14 };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--muted)', padding: 2, cursor: 'pointer', display: 'grid', placeItems: 'center' };
const errMsg = (e: unknown) => (e instanceof ApiError ? e.problem?.detail || e.message : 'Unexpected error');
const pretty = (c: string) => c.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
