import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UpsertSalesChannelRuleSchema } from './validators.ts';

describe('UpsertSalesChannelRuleSchema', () => {
  it('accepts a valid array of channel ids', () => {
    const result = UpsertSalesChannelRuleSchema.safeParse({
      sales_channel_ids: ['sc_01', 'sc_02'],
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(result.data.sales_channel_ids, ['sc_01', 'sc_02']);
    }
  });

  it('accepts a single channel id', () => {
    const result = UpsertSalesChannelRuleSchema.safeParse({
      sales_channel_ids: ['sc_abc'],
    });
    assert.equal(result.success, true);
  });

  it('rejects an empty array', () => {
    const result = UpsertSalesChannelRuleSchema.safeParse({
      sales_channel_ids: [],
    });
    assert.equal(result.success, false);
  });

  it('rejects non-string items in the array', () => {
    const result = UpsertSalesChannelRuleSchema.safeParse({
      sales_channel_ids: [123, 456],
    });
    assert.equal(result.success, false);
  });

  it('rejects empty strings in the array', () => {
    const result = UpsertSalesChannelRuleSchema.safeParse({
      sales_channel_ids: [''],
    });
    assert.equal(result.success, false);
  });

  it('rejects missing field', () => {
    const result = UpsertSalesChannelRuleSchema.safeParse({});
    assert.equal(result.success, false);
  });

  it('strips unknown fields (strip mode)', () => {
    const result = UpsertSalesChannelRuleSchema.safeParse({
      sales_channel_ids: ['sc_01'],
      unknown_extra_field: 'should be removed',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal('unknown_extra_field' in result.data, false);
    }
  });
});
