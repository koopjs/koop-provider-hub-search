import { IHubContent } from '@esri/hub-common';
import { IContentSearchRequest, IContentSearchResponse, searchContent } from '@esri/hub-search';
import { PassThrough, pipeline } from 'stream';
import { promisify } from 'util';
import { PagingStream } from '../paging-stream';
import { getPagingStream } from './get-paging-stream';

jest.mock('@esri/hub-search');

describe('getPagingStream function', () => {
  let mockedSearchContent = searchContent as unknown as jest.MockedFunction<typeof searchContent>;

  beforeEach(() => {
    mockedSearchContent.mockReset();
  });

  it('can instantiate and return a paging stream', async () => {
    try {
      // Setup
      const request: IContentSearchRequest = {
        filter: { terms: 'yellow submarine' }
      }

      // Mock
      const mockedResults = [
        {
          id: '1'
        }
      ];
      const mockedResponse: IContentSearchResponse = {
        total: 1,
        query: 'yellow submarine',
        results: mockedResults as unknown as IHubContent[],
        count: 1,
        hasNext: false,
        next: () => null
      }

      mockedSearchContent.mockResolvedValue(mockedResponse);

      // Test
      const responses = [];
      const stream: PagingStream = getPagingStream(request);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        responses.push(data);
      });

      const pipe = promisify(pipeline);
      await pipe(stream, pass);

      // Assert
      expect(mockedSearchContent).toBeCalledTimes(1);
      expect(mockedSearchContent).toHaveBeenNthCalledWith(1, request);
      expect(responses).toHaveLength(1);
      expect(responses[0]).toEqual(mockedResults[0]);
    } catch (err) {
      fail(err);
    }
  });

  it('can instantiate and return multiple pages', async () => {
    try {
      // Setup
      const request: IContentSearchRequest = {
        filter: { terms: 'yellow submarine' }
      }

      // Mock
      const mockedResultsOne = [
        {
          id: '1'
        }
      ];
      const mockedResponseOne: IContentSearchResponse = {
        total: 1,
        query: 'yellow submarine',
        results: mockedResultsOne as unknown as IHubContent[],
        count: 1,
        hasNext: true,
        next: () => Promise.resolve(mockedResponseTwo)
      }
      const mockedResultsTwo = [
        {
          id: '2'
        }
      ];
      const mockedResponseTwo: IContentSearchResponse = {
        total: 2,
        query: 'yellow submarine',
        results: mockedResultsTwo as unknown as IHubContent[],
        count: 1,
        hasNext: false,
        next: () => null
      }

      mockedSearchContent.mockResolvedValueOnce(mockedResponseOne);
      mockedSearchContent.mockResolvedValueOnce(mockedResponseTwo);

      // Test
      const responses = [];
      const stream: PagingStream = getPagingStream(request);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        responses.push(data);
      });

      const pipe = promisify(pipeline);
      await pipe(stream, pass);

      // Assert
      expect(mockedSearchContent).toBeCalledTimes(1);
      expect(mockedSearchContent).toHaveBeenNthCalledWith(1, request);
      expect(responses).toHaveLength(2);
      expect(responses[0]).toEqual(mockedResultsOne[0]);
      expect(responses[1]).toEqual(mockedResultsTwo[0]);
    } catch (err) {
      fail(err);
    }
  });

  it('caps returned pages to page limit', async () => {
    try {
      // Setup
      const request: IContentSearchRequest = {
        filter: { terms: 'yellow submarine' }
      }

      // Mock
      const mockedResultsOne = [
        {
          id: '1'
        }
      ];
      const mockedResponseOne: IContentSearchResponse = {
        total: 1,
        query: 'yellow submarine',
        results: mockedResultsOne as unknown as IHubContent[],
        count: 1,
        hasNext: true,
        next: () => Promise.resolve(mockedResponseTwo)
      }
      const mockedResultsTwo = [
        {
          id: '2'
        }
      ];
      const mockedResponseTwo: IContentSearchResponse = {
        total: 2,
        query: 'yellow submarine',
        results: mockedResultsTwo as unknown as IHubContent[],
        count: 1,
        hasNext: false,
        next: () => null
      }

      mockedSearchContent.mockResolvedValueOnce(mockedResponseOne);
      mockedSearchContent.mockResolvedValueOnce(mockedResponseTwo);

      // Test
      const responses = [];
      const stream: PagingStream = getPagingStream(request, 1);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        responses.push(data);
      });

      const pipe = promisify(pipeline);
      await pipe(stream, pass);

      // Assert
      expect(mockedSearchContent).toBeCalledTimes(1);
      expect(mockedSearchContent).toHaveBeenNthCalledWith(1, request);
      expect(responses).toHaveLength(1);
      expect(responses[0]).toEqual(mockedResultsOne[0]);
    } catch (err) {
      fail(err);
    }
  });
});