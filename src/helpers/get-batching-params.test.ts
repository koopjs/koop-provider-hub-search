import { IContentSearchRequest } from '@esri/hub-search';
import { fetchTotalResults } from './fetch-total-results';
import { getBatchingParams } from './get-batching-params';

jest.mock('./fetch-total-results')

describe('getBatchedParams function', () => {
  const fetchTotalResultsMock = fetchTotalResults as unknown as jest.MockedFunction<typeof fetchTotalResults>;

  beforeEach(() => {
    fetchTotalResultsMock.mockReset();
  });

  it('returns the correct params when pagination is not provided', async () => {
    // Setup
    const request: IContentSearchRequest = {};

    // Mock
    fetchTotalResultsMock.mockResolvedValue(324);

    // Test
    const {
      numBatches,
      pagesPerBatch,
      pageSize
    } = await getBatchingParams(request);

    expect(numBatches).toEqual(4);
    expect(pagesPerBatch).toEqual(1);
    expect(pageSize).toEqual(100);
  });

  it('returns correct params when there are no results', async () => {
    // Setup
    const request: IContentSearchRequest = {
      options: { page: 'eyJodWIiOnsic2l6ZSI6Mi4zNCwic3RhcnQiOjF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==' }
    };

    // Mock
    fetchTotalResultsMock.mockResolvedValue(0);

    // Test
    const {
      numBatches,
      pagesPerBatch,
      pageSize
    } = await getBatchingParams(request);

    expect(numBatches).toEqual(0);
    expect(pagesPerBatch).toEqual(0);
    expect(pageSize).toEqual(0);
  });

  it('returns correct params when fetch does not return integer', async () => {
    // Setup
    const request: IContentSearchRequest = {
      options: { page: 'eyJodWIiOnsic2l6ZSI6Mi4zNCwic3RhcnQiOjF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==' }
    };

    // Mock
    fetchTotalResultsMock.mockResolvedValue('hey there' as unknown as number);

    // Test
    const {
      numBatches,
      pagesPerBatch,
      pageSize
    } = await getBatchingParams(request);

    expect(numBatches).toEqual(0);
    expect(pagesPerBatch).toEqual(0);
    expect(pageSize).toEqual(0);
  });

  it('caps the maximum number of batches at 5', async () => {
    // Setup
    const request: IContentSearchRequest = {
      options: { page: 'eyJodWIiOnsic2l6ZSI6NSwic3RhcnQiOjF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==' }
    };

    // Mock
    fetchTotalResultsMock.mockResolvedValue(100);

    // Test
    const {
      numBatches,
      pagesPerBatch,
      pageSize
    } = await getBatchingParams(request);

    expect(numBatches).toEqual(5);
    expect(pagesPerBatch).toEqual(5);
    expect(pageSize).toEqual(5);
  });

  it('defaults the pageSize to 100 when key is not valid JSON', async () => {
    // Setup
    const request: IContentSearchRequest = {
      options: { page: '1xxYY' }
    };

    // Mock
    fetchTotalResultsMock.mockResolvedValue(324);

    // Test
    const {
      numBatches,
      pagesPerBatch,
      pageSize
    } = await getBatchingParams(request);

    expect(numBatches).toEqual(4);
    expect(pagesPerBatch).toEqual(1);
    expect(pageSize).toEqual(100);
  });

  it('defaults the pageSize to 100 when hub size param is not in key', async () => {
    // Setup
    const request: IContentSearchRequest = {
      options: { page: 'eyJodWIiOnsic3RhcnQiOjF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==' }
    };

    // Mock
    fetchTotalResultsMock.mockResolvedValue(324);

    // Test
    const {
      numBatches,
      pagesPerBatch,
      pageSize
    } = await getBatchingParams(request);

    expect(numBatches).toEqual(4);
    expect(pagesPerBatch).toEqual(1);
    expect(pageSize).toEqual(100);
  });

  it('defaults the pageSize to 100 when hub size param is provided but is not integer', async () => {
    // Setup
    const request: IContentSearchRequest = {
      options: { page: 'eyJodWIiOnsic2l6ZSI6Mi4zNCwic3RhcnQiOjF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==' }
    };

    // Mock
    fetchTotalResultsMock.mockResolvedValue(324);

    // Test
    const {
      numBatches,
      pagesPerBatch,
      pageSize
    } = await getBatchingParams(request);

    expect(numBatches).toEqual(4);
    expect(pagesPerBatch).toEqual(1);
    expect(pageSize).toEqual(100);
  });
});