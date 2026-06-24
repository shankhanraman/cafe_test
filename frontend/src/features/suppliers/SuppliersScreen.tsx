import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useGetSupplier,
} from '../../api/generated/suppliers/suppliers';
import type { SupplierResponse } from '../../api/generated/model/supplierResponse';
import { useApp } from '../../app/app-context';
import { ApiError } from '../../api/http-client';
import { Card, Button, Avatar, Modal, money } from '../../components/ui';
import { IconPlus, IconEdit } from '../../lib/icons';

// Learned aliases + purchase history are part of the OCR flow (design-ahead-of-API); shown
// here from demo data per the handoff until those endpoints exist.
const ALIASES: Record<string, [string, string][]> = {
  'sup-greenleaf': [['Tamatar', 'Tomatoes'], ['Adrak', 'Ginger'], ['Tamaatar', 'Tomatoes'], ['Hari mirch', 'Green chilli'], ['Pyaaz', 'Onion']],
  'sup-acme': [['Dudh', 'Milk'], ['Doodh', 'Milk']],
  'sup-kirana': [['Chini', 'Sugar sachet'], ['Elaichi', 'Cardamom']],
};
const HISTORY: Record<string, { date: string; items: number; total: number }[]> = {
  'sup-greenleaf': [{ date: '21 Jun', items: 8, total: 1320 }, { date: '18 Jun', items: 6, total: 940 }],
  'sup-acme': [{ date: '21 Jun', items: 2, total: 640 }, { date: '20 Jun', items: 2, total: 640 }],
  'sup-kirana': [{ date: '17 Jun', items: 11, total: 2180 }],
};

export function SuppliersScreen() {
  const suppliers = useListSuppliers().data?.data ?? [];
  const [selId, setSelId] = useState<string>('');
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null);
  const sel = suppliers.find((s) => s.id === selId) ?? suppliers[0];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Suppliers</h1>
        <Button onClick={() => setForm({ mode: 'create' })}><IconPlus size={16} /> Add supplier</Button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suppliers.map((s) => {
            const hist = HISTORY[s.id] ?? [];
            const spend = hist.reduce((sum, h) => sum + h.total, 0);
            return (
              <button
                key={s.id}
                onClick={() => setSelId(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer',
                  background: 'var(--card)', border: '1px solid', borderColor: s.id === sel?.id ? 'var(--pine-700)' : 'var(--border)',
                  boxShadow: s.id === sel?.id ? 'none' : 'var(--shadow-card)',
                  outline: s.id === sel?.id ? '1px solid var(--pine-700)' : 'none',
                }}
              >
                <Avatar label={initials(s.name)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>{(ALIASES[s.id] ?? []).length} aliases · {(HISTORY[s.id] ?? []).length} bills</div>
                </div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{money(spend)}</span>
              </button>
            );
          })}
        </div>

        {sel && (
          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid var(--divider)' }}>
              <Avatar label={initials(sel.name)} />
              <div style={{ flex: 1 }}>
                <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>{sel.name}</div>
                <div style={{ fontSize: 13, color: 'var(--faint)' }}>{sel.phone ?? 'No phone'} · {sel.notes || 'Supplier'}</div>
              </div>
              <Button variant="ghost" style={{ padding: '8px 12px' }} onClick={() => setForm({ mode: 'edit', id: sel.id })}>
                <IconEdit size={15} /> Edit
              </Button>
              <DeleteSupplierButton supplier={sel} onDeleted={() => setSelId('')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingTop: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Learned aliases</div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--pine-700)', fontSize: 12.5, fontWeight: 600 }}>Add manually</button>
                </div>
                {(ALIASES[sel.id] ?? []).map(([from, to]) => (
                  <div key={from} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 13.5, borderBottom: '1px solid var(--divider)' }}>
                    <span className="dvn" style={{ color: 'var(--muted)' }}>{from}</span>
                    <span style={{ color: 'var(--faint)' }}>→</span>
                    <span style={{ fontWeight: 600 }}>{to}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Purchase history</div>
                {(HISTORY[sel.id] ?? []).map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13.5, borderBottom: '1px solid var(--divider)' }}>
                    <span style={{ color: 'var(--muted)' }}>{h.date}</span>
                    <span style={{ color: 'var(--faint)' }}>{h.items} items</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{money(h.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {form && (
        <SupplierFormModal
          mode={form.mode}
          id={form.mode === 'edit' ? form.id : undefined}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setSelId(id);
            setForm(null);
          }}
        />
      )}
    </div>
  );
}

function DeleteSupplierButton({ supplier, onDeleted }: { supplier: SupplierResponse; onDeleted: () => void }) {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const del = useDeleteSupplier();
  const remove = async () => {
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) return;
    try {
      await del.mutateAsync({ id: supplier.id });
      await qc.invalidateQueries({ queryKey: ['/api/suppliers'] });
      showToast({ title: 'Supplier deleted', sub: supplier.name });
      onDeleted();
    } catch (e) {
      showToast({ title: 'Could not delete supplier', sub: errMsg(e) });
    }
  };
  return (
    <Button variant="danger" style={{ padding: '8px 12px' }} disabled={del.isPending} onClick={remove}>
      Delete
    </Button>
  );
}

function SupplierFormModal({
  mode,
  id,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  id?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  // Load the current record by id when editing — exercises GET /api/suppliers/{id}.
  const existing = useGetSupplier(id ?? '', { query: { enabled: mode === 'edit' && !!id } });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const res = existing.data;
    if (mode === 'edit' && res?.status === 200) {
      const s = res.data;
      setName(s.name);
      setPhone(s.phone ?? '');
      setNotes(s.notes ?? '');
    }
  }, [mode, existing.data]);

  const pending = create.isPending || update.isPending;
  const save = async () => {
    const data = { name: name.trim(), phone: phone.trim() || null, notes: notes.trim() || null };
    try {
      const res =
        mode === 'edit' && id
          ? await update.mutateAsync({ id, data })
          : await create.mutateAsync({ data });
      await qc.invalidateQueries({ queryKey: ['/api/suppliers'] });
      showToast({ title: mode === 'edit' ? 'Supplier updated' : 'Supplier added', sub: data.name });
      if (res.status === 200 || res.status === 201) onSaved(res.data.id);
    } catch (e) {
      showToast({ title: 'Could not save supplier', sub: errMsg(e) });
    }
  };

  const loading = mode === 'edit' && existing.isLoading;
  return (
    <Modal title={mode === 'edit' ? 'Edit supplier' : 'Add supplier'} width={460} onClose={onClose}>
      {loading ? (
        <div style={{ padding: 24, color: 'var(--faint)', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Phone" value={phone} onChange={setPhone} />
          <Field label="Notes" value={notes} onChange={setNotes} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={!name.trim() || pending} onClick={save}>
              {mode === 'edit' ? 'Save changes' : 'Add supplier'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="eyebrow" style={{ color: 'var(--faint)', marginBottom: 6 }}>{label}</div>
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14 }}
      />
    </div>
  );
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.problem?.detail || e.message : 'Unexpected error');
const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
