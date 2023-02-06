import * as faker from 'faker';
import { searchContent } from '@esri/hub-search';
import { PagingStream } from '../paging-stream';
import { getBatchedStreams, BatchSearch } from './get-batched-streams';
import * as GetPagingStream from './get-paging-stream';
import { HubSite } from './enrich-dataset';

jest.mock('@esri/hub-search');

describe('getBatchedStreams function', () => {
  const searchContentMock = searchContent as unknown as jest.MockedFunction<typeof searchContent>;
  const getPagingStreamSpy = jest.spyOn(GetPagingStream, 'getPagingStream');

  beforeEach(() => {
    searchContentMock.mockReset();
    getPagingStreamSpy.mockReset();
  });

  it('can handle not returning any streams', async () => {
    // Setup
    const randTerms = faker.random.words();
    const batchSearch: BatchSearch = {
      request: {
        filter: { terms: randTerms },
        options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoxfSwiYWdvIjp7InNpemUiOjAsInN0YXJ0IjoxfX0=', portal: 'arcgis.com' },
      },
      siteUrl: 'arcgis.com'
    }

    // Mock
    searchContentMock.mockResolvedValueOnce({
      total: 0,
      count: 0,
      hasNext: false,
      next: () => null,
      results: [],
      query: randTerms
    });

    // Test
    try {
      const streams: PagingStream[] = await getBatchedStreams(batchSearch);

      // Assert
      expect(searchContentMock).toHaveBeenCalledTimes(1);
      expect(searchContentMock).toHaveBeenNthCalledWith(1, {
        filter: { terms: randTerms },
        options: { page: 'eyJodWIiOnsic2l6ZSI6MH0sImFnbyI6eyJzaXplIjowfX0=', portal: 'arcgis.com' }
      });
      expect(getPagingStreamSpy).toHaveBeenCalledTimes(0);
      expect(streams).toHaveLength(0);
    } catch (err) {
      fail(err);
    }
  });

  it('can return several streams', async () => {
    // Setup
    const randTerms = faker.random.words();

    const batchSearch: BatchSearch = {
      request: {
        filter: { terms: randTerms },
        options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoxfSwiYWdvIjp7InNpemUiOjAsInN0YXJ0IjoxfX0=', portal: 'arcgis.com' },
      },
      siteUrl: 'arcgis.com'
    }
    const hubSite: HubSite = {
      siteUrl: batchSearch.siteUrl,
      portalUrl: batchSearch.request.options?.portal  || ''
    }

    // Mock
    searchContentMock.mockResolvedValueOnce({
      total: 324,
      count: 0,
      hasNext: false,
      next: () => null,
      results: [],
      query: randTerms
    });

    // Test
    try {
      const streams: PagingStream[] = await getBatchedStreams(batchSearch);

      // Assert
      expect(searchContentMock).toHaveBeenCalledTimes(1);
      expect(searchContentMock).toHaveBeenNthCalledWith(1, {
        filter: { terms: randTerms },
        options: { page: 'eyJodWIiOnsic2l6ZSI6MH0sImFnbyI6eyJzaXplIjowfX0=', portal: 'arcgis.com'  }
      });
      expect(getPagingStreamSpy).toHaveBeenCalledTimes(5);
      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(1,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoxfSwiYWdvIjp7InNpemUiOjAsInN0YXJ0IjoxfX0=', portal: 'arcgis.com'  }
        },
        hubSite,
        2
      );
      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(2,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoxMDF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==', portal: 'arcgis.com'  }
        },
        hubSite,
        2
      );
      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(3,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoyMDF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==', portal: 'arcgis.com'  }
        },
        hubSite,
        2
      );
      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(4,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjozMDF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==', portal: 'arcgis.com'  }
        },
        hubSite,
        2
      );
      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(5,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0Ijo0MDF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==', portal: 'arcgis.com'  }
        },
        hubSite,
        2
      );
      expect(streams).toHaveLength(5);
    } catch (err) {
      fail(err);
    }
  });

  it('can properly generate streams based on limit if provided', async () => {
    // Setup
    const randTerms = faker.random.words();
    
    // Test
    try {
      const limit: number = 523;
      const batchSearch: BatchSearch = {
        request: {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoxfSwiYWdvIjp7InNpemUiOjAsInN0YXJ0IjoxfX0=', portal: 'arcgis.com' },
        },
        siteUrl: 'arcgis.com',
        limit
      }

      const hubSite: HubSite = {
        siteUrl: batchSearch.siteUrl,
        portalUrl: batchSearch.request.options?.portal  || ''
      }

      const streams: PagingStream[] = await getBatchedStreams(batchSearch);

      // Assert
      expect(searchContentMock).toHaveBeenCalledTimes(0);

      expect(getPagingStreamSpy).toHaveBeenCalledTimes(4);

      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(1,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoxfSwiYWdvIjp7InNpemUiOjAsInN0YXJ0IjoxfX0=', portal: 'arcgis.com' }
        },
        hubSite,
        3
      );

      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(2,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjoxNTF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==', portal: 'arcgis.com' }
        },
        hubSite,
        3
      );

      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(3,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NTAsInN0YXJ0IjozMDF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==', portal: 'arcgis.com'}
        },
        hubSite,
        3
      );

      expect(getPagingStreamSpy).toHaveBeenNthCalledWith(4,
        {
          filter: { terms: randTerms },
          options: { page: 'eyJodWIiOnsic2l6ZSI6NzMsInN0YXJ0Ijo0NTF9LCJhZ28iOnsic2l6ZSI6MCwic3RhcnQiOjF9fQ==', portal: 'arcgis.com' }
        },
        hubSite,
        1
      );
      
      expect(streams).toHaveLength(4);
    } catch (err) {
      fail(err);
    }
  });



});

