import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import ProductCard from '../../app/components/ProductCard.vue';
import FormShell from '../../app/components/FormShell.vue';
import ApiNotice from '../../app/components/ApiNotice.vue';
import LoadState from '../../app/components/LoadState.vue';
import { toman, safeReturn, productSchema, errorMessage } from '../../shared/domain';
import { allowedBrowserRoute, backendBase } from '../../shared/proxy-policy';
const product = {
  sku: 'YARIZAN-G1',
  grade: 1,
  title_fa: 'یاریزان پایه اول',
  price_irr: 12990000,
  publication_status: 'published' as const,
  sale_enabled: true,
  trial_enabled: true,
  activation_enabled: true,
  revision: 1,
};
const NuxtLink = defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' });
describe('Catalog and commercial boundaries', () => {
  it('converts integer IRR to Toman without hardcoding catalog prices', () => {
    expect(toman(12990000)).toBe('۱٬۲۹۹٬۰۰۰');
    expect(toman(15000000)).toBe('۱٬۵۰۰٬۰۰۰');
    expect(toman(9007199254740983)).toBe('۹۰۰٬۷۱۹٬۹۲۵٬۴۷۴٬۰۹۸٫۳');
    expect(toman(9007199254740987)).toBe('۹۰۰٬۷۱۹٬۹۲۵٬۴۷۴٬۰۹۸٫۷');
    expect(() => toman(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => toman(-1)).toThrow();
  });
  it('rejects malformed server catalog and unsupported grades', () => {
    expect(productSchema.safeParse({ ...product, grade: 7 }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, price_irr: 0.5 }).success).toBe(false);
  });
  it('renders real supplied price and product link', () => {
    const wrapper = mount(ProductCard, { props: { product }, global: { stubs: { NuxtLink } } });
    expect(wrapper.text()).toContain('۱٬۲۹۹٬۰۰۰');
    expect(wrapper.find('a').attributes('href')).toBe('/products/grade-1');
  });
  it('shows Coming Soon without an executable checkout', () => {
    const wrapper = mount(ProductCard, {
      props: {
        product: {
          ...product,
          sku: 'YARIZAN-G2',
          grade: 2,
          publication_status: 'coming_soon',
          sale_enabled: false,
        },
      },
      global: { stubs: { NuxtLink } },
    });
    expect(wrapper.text()).toContain('به‌زودی');
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('/checkout');
  });
});
describe('Browser security policy', () => {
  it('allows only local internal backend destination', () => {
    expect(backendBase('http://api:3100/api/v2/').hostname).toBe('api');
    for (const url of [
      'http://evil.invalid:3100/api/v2/',
      'http://127.0.0.1:3100/private',
      'http://user:secret@localhost:3100/api/v2/',
      'file:///etc/passwd',
      'http://127.0.0.1:3100/api/v2/?target=x',
    ])
      expect(() => backendBase(url)).toThrow();
  });
  it('never proxies desktop proof, bearer or legacy enrollment routes', () => {
    for (const path of [
      'devices/challenges',
      'devices/authenticate',
      'devices/register',
      'device-pairings/10000000-0000-4000-8000-000000000001/pickup',
      'desktop/licenses/pickup',
      'products/%2e%2e/devices/authenticate',
    ])
      expect(allowedBrowserRoute('POST', path)).toBe(false);
    expect(allowedBrowserRoute('GET', 'products')).toBe(true);
  });
  it('blocks open redirects while preserving approved account routes', () => {
    for (const target of [
      'https://evil.invalid',
      '//evil.invalid',
      '/account/../zanyari',
      'javascript:alert(1)',
      '/account?x=secret',
      '/\\evil.invalid',
    ])
      expect(safeReturn(target)).toBe('/account');
    expect(safeReturn('/account/licenses')).toBe('/account/licenses');
  });
  it('does not echo raw server errors or identifiers', () => {
    expect(
      errorMessage({ data: { error: { code: 'INVALID_CREDENTIALS', message: 'secret' } } }),
    ).not.toContain('secret');
    expect(errorMessage({ data: { error: { code: 'PRIVATE_TOKEN' } } })).not.toContain(
      'PRIVATE_TOKEN',
    );
  });
});
describe('Loading and recovery states', () => {
  it('exposes loading with status semantics', () => {
    const wrapper = mount(LoadState, { props: { loading: true } });
    expect(wrapper.get('[role=status]').text()).toContain('در حال');
  });
  it('provides explicit retry for failure', async () => {
    const wrapper = mount(LoadState, { props: { error: true } });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
  it('shows an honest empty state', () => {
    expect(mount(LoadState, { props: { empty: true } }).text()).toContain('هنوز');
  });
});

describe('Custom accessible form feedback', () => {
  it('blocks empty submission with Persian inline error and no native validation', async () => {
    const w = mount(FormShell, {
      attachTo: document.body,
      slots: {
        default:
          '<label>نام کاربری<input required data-label="نام کاربری"/></label><button>ورود</button>',
      },
    });
    await w.get('form').trigger('submit');
    expect(w.get('form').attributes()).toHaveProperty('novalidate');
    expect(w.get('input').attributes('aria-invalid')).toBe('true');
    expect(w.text()).toContain('نام کاربری را وارد کنید');
    expect(w.emitted('submit')).toBeUndefined();
    expect(document.activeElement).toBe(w.get('input').element);
    expect(w.get('input').attributes('aria-describedby')).toBeTruthy();
    w.unmount();
  });
  it('shows password mismatch and emits only a complete matching form', async () => {
    const Host = defineComponent({
      components: { FormShell },
      setup() {
        return { a: ref('Long!Password123'), b: ref('different-password') };
      },
      template:
        '<FormShell><label>رمز عبور<input v-model="a" name="password" required minlength="12"/></label><label>تکرار<input v-model="b" data-match="password" required/></label></FormShell>',
    });
    const w = mount(Host, { attachTo: document.body });
    await w.get('form').trigger('submit');
    expect(w.text()).toContain('یکسان نیستند');
    await w.findAll('input')[1]!.setValue('Long!Password123');
    await w.get('form').trigger('submit');
    expect(w.getComponent(FormShell).emitted('submit')).toHaveLength(1);
    w.unmount();
  });
  it('uses an alert and explicit retry for server errors', async () => {
    const w = mount(ApiNotice, { props: { message: 'ارسال پیامک در دسترس نیست.', retry: true } });
    expect(w.get('[role=alert]').text()).toContain('پیامک');
    await w.get('button').trigger('click');
    expect(w.emitted('retry')).toHaveLength(1);
  });
});

describe('Commerce financial and navigation boundaries', () => {
  it('formats large aggregate IRR without floating point loss', async () => {
    const { financialToman } = await import('../../shared/commerce');
    expect(financialToman('90071992547409915')).toBe(
      new Intl.NumberFormat('fa-IR').format(9007199254740991n) + '٫۵',
    );
    expect(financialToman('-1')).toBe('—');
  });
  it('keeps unknown results distinct from paid and fulfilled states', async () => {
    const { commerceState } = await import('../../shared/commerce');
    expect(commerceState({ state: 'PENDING', payments: [{ state: 'UNKNOWN' }] })).toContain(
      'مشخص نیست',
    );
    expect(commerceState({ state: 'FULFILLMENT_PENDING', paid_at: 'now' })).toContain('آماده‌سازی');
    expect(commerceState({ state: 'FULFILLED' })).toContain('آماده است');
  });
  it('only retains the exact eligible checkout return path', () => {
    expect(safeReturn('/checkout?sku=YARIZAN-G1')).toBe('/checkout?sku=YARIZAN-G1');
    expect(safeReturn('/checkout?sku=YARIZAN-G1&next=https://example.com')).toBe('/account');
  });
});
