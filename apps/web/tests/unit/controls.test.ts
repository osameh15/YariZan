import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref, nextTick } from 'vue';
import { persianDate, persianParts, persianMonthDays } from '../../shared/persian-date';
import AppSelect from '../../app/components/AppSelect.vue';
import NumberStepper from '../../app/components/NumberStepper.vue';
import FormShell from '../../app/components/FormShell.vue';
import { decimalValue } from '../../shared/decimal-input';

describe('Solar Hijri dates preserve Gregorian API dates', () => {
  it.each([
    [1403, 1, 1, '2024-03-20'],
    [1403, 12, 30, '2025-03-20'],
    [1404, 1, 1, '2025-03-21'],
    [1405, 7, 24, '2026-10-16'],
  ])('converts %i/%i/%i exactly', (year, month, day, iso) => {
    expect(persianDate(Number(year), Number(month), Number(day))).toBe(iso);
  });
  it('round trips every day through leap and ordinary years', () => {
    for (const year of [1403, 1404])
      for (let month = 1; month <= 12; month++)
        for (let day = 1; day <= persianMonthDays(year, month); day++) {
          expect(persianParts(new Date(persianDate(year, month, day) + 'T00:00:00Z'))).toEqual({
            year,
            month,
            day,
          });
        }
    expect(persianMonthDays(1403, 12)).toBe(30);
    expect(persianMonthDays(1404, 12)).toBe(29);
  });
  it('rejects invalid and out-of-range dates', () => {
    for (const [y, m, d] of [
      [1404, 12, 30],
      [1405, 7, 31],
      [0, 1, 1],
      [1405, 13, 1],
    ])
      expect(() => persianDate(y!, m!, d!)).toThrow(RangeError);
  });
});
describe('Custom form controls', () => {
  it('steps exact safe-integer IRR without overflowing', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 9007199254740990, label: 'مبلغ' } });
    await w.get('button:last-child').trigger('click');
    expect(w.emitted('update:modelValue')?.[0]?.[0]).toBe(9007199254740991);
    await w.setProps({ modelValue: 9007199254740991 });
    expect(w.get('button:last-child').attributes('disabled')).toBeDefined();
  });
  it('steps decimal display values and accepts Persian digits', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 0.2, step: 0.1, label: 'مقدار' } });
    await w.get('button:last-child').trigger('click');
    expect(w.emitted('update:modelValue')?.[0]?.[0]).toBe(0.3);
    await w.get('input').setValue('۱۲٫۳');
    expect(w.emitted('update:modelValue')?.at(-1)?.[0]).toBe(12.3);
  });
  it('does not propagate invalid fractional years or out-of-range values', async () => {
    const w = mount(NumberStepper, {
      props: { modelValue: 1405, min: 1, max: 2999, label: 'سال' },
    });
    await w.get('input').setValue('1.5');
    await w.get('input').setValue('3000');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
  it('supports dropdown keyboard selection and Escape', async () => {
    const w = mount(AppSelect, {
      props: {
        modelValue: 'a',
        label: 'وضعیت',
        options: [
          { value: 'a', label: 'فعال' },
          { value: 'b', label: 'غیرفعال' },
        ],
      },
    });
    await w.get('[role="combobox"]').trigger('keydown', { key: 'ArrowDown' });
    await w.get('[role="combobox"]').trigger('keydown', { key: 'ArrowDown' });
    await w.get('[role="combobox"]').trigger('keydown', { key: 'Enter' });
    expect(w.emitted('update:modelValue')?.[0]?.[0]).toBe('b');
    await w.get('[role="combobox"]').trigger('click');
    await w.get('[role="combobox"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="listbox"]').exists()).toBe(false);
  });
  it('custom required errors focus the visible combobox', async () => {
    const w = mount(
      defineComponent({
        components: { FormShell, AppSelect },
        setup() {
          return { value: ref('') };
        },
        template:
          '<FormShell><AppSelect v-model="value" label="پایه" :options="[{value: \'one\', label: \'اول\'}]" required /><button>ثبت</button></FormShell>',
      }),
      { attachTo: document.body },
    );
    await w.get('form').trigger('submit');
    await nextTick();
    expect(w.get('[role="combobox"]').attributes('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(w.get('[role="combobox"]').element);
    w.unmount();
  });
});

it('rejects silently rounded decimal input and exact step mismatches', () => {
  expect(decimalValue('9007199254740991.1', '0.1')).toBeUndefined();
  expect(decimalValue('1.5', '1')).toBeUndefined();
  expect(decimalValue('1e3')).toBeUndefined();
  expect(decimalValue('12.30', '0.1')).toBe(12.3);
});
