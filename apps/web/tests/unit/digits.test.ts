import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { persianDigits, asciiDigits } from '../../shared/digits';
import PersianNumberInput from '../../app/components/PersianNumberInput.vue';
describe('Persian display digits and ASCII transport', () => {
  it('preserves huge exact decimal strings, masks and punctuation', () => {
    expect(persianDigits('9007199254740991.1')).toBe('۹۰۰۷۱۹۹۲۵۴۷۴۰۹۹۱.۱');
    expect(persianDigits('09***123')).toBe('۰۹***۱۲۳');
    expect(asciiDigits('۱۲۳٤٥٦')).toBe('123456');
  });
  it('displays Persian phone/OTP input while emitting ASCII', async () => {
    const view = mount(PersianNumberInput, { props: { modelValue: '', type: 'tel' } });
    await view.get('input').setValue('09123456789');
    expect(view.get('input').element.value).toBe('۰۹۱۲۳۴۵۶۷۸۹');
    expect(view.emitted('update:modelValue')?.[0]).toEqual(['09123456789']);
    await view.get('input').setValue('۱۲٣456');
    expect(view.get('input').element.value).toBe('۱۲۳۴۵۶');
    expect(view.emitted('update:modelValue')?.[1]).toEqual(['123456']);
  });
});
