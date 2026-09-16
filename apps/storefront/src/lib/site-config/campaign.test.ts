import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CAMPAIGN_ILLUSTRATION, resolveCampaignHeroImage } from './campaign';

describe('resolveCampaignHeroImage', () => {
  it('usa la ilustración genérica cuando la imagen está ausente o vacía', () => {
    assert.equal(resolveCampaignHeroImage(), DEFAULT_CAMPAIGN_ILLUSTRATION);
    assert.equal(resolveCampaignHeroImage(''), DEFAULT_CAMPAIGN_ILLUSTRATION);
    assert.equal(resolveCampaignHeroImage('   '), DEFAULT_CAMPAIGN_ILLUSTRATION);
  });

  it('preserva una imagen configurada por el site', () => {
    assert.equal(
      resolveCampaignHeroImage(' https://cdn.example.com/campaign.webp '),
      'https://cdn.example.com/campaign.webp'
    );
  });
});
