import * as faker from 'faker';
import getProvider from '../src';
import { HubApiModel } from '../src/model';

describe('provider registration', () => {
  it('creates a provider options object', () => {
    const provider = getProvider();

    expect(provider).toBeDefined();
    expect(provider.name).toBe('hub-search-api-provider');
    expect(provider.type).toBe('provider');
    expect(provider.disableIdParam).toBe(true);
    expect(provider.Model).toEqual(HubApiModel);
    expect(provider.defaultSiteUrl).toBe('https://hub.arcgis.com');
  });

  it('can override the default site URL', () => {
    const siteUrl = faker.internet.url();
    const provider = getProvider({ defaultSiteUrl: siteUrl });
    expect(provider.defaultSiteUrl).toBe(siteUrl);
  });
});
