const providerConfig = require('../src');
import { HubApiModel } from '../src/model';

describe('provider registration', () => {
  it('creates a provider options object', () => {
    expect(providerConfig).toBeDefined();
    expect(providerConfig.name).toBe('hub-search-api-provider');
    expect(providerConfig.type).toBe('provider');
    expect(providerConfig.disableIdParam).toBe(true);
    expect(providerConfig.Model).toEqual(HubApiModel);
  });
});
