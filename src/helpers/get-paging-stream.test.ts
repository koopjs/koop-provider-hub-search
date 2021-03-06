import { DatasetResource } from '@esri/hub-common';
import { IContentSearchRequest, searchDatasets } from '@esri/hub-search';
import { PassThrough, pipeline } from 'stream';
import { promisify } from 'util';
import { PagingStream } from '../paging-stream';
import { getPagingStream } from './get-paging-stream';

jest.mock('@esri/hub-search');

describe('getPagingStream function', () => {
  let mockedSearchDatasets = searchDatasets as unknown as jest.MockedFunction<typeof searchDatasets>;
  let fetch: jest.MockedFunction<any>;

  beforeEach(() => {
    mockedSearchDatasets.mockReset();
    global.fetch = jest.fn();
    fetch = global.fetch;
    fetch.mockReset();
  });

  it('can instantiate and return a paging stream', async () => {
    try {
      // Setup
      const request: IContentSearchRequest = {
        filter: { terms: 'yellow submarine' }
      }

      // Mock
      const mockedResponse: { data: DatasetResource[] } = {
        data: [
          {
            id: '1',
            type: 'dataset',
            attributes: {
              title: 'yellow submarine',
              type: 'feature layer'
            }
          }
        ],
      }

      mockedSearchDatasets.mockResolvedValue(mockedResponse);

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
      expect(mockedSearchDatasets).toBeCalledTimes(1);
      expect(mockedSearchDatasets).toHaveBeenNthCalledWith(1, request);
      expect(responses).toHaveLength(1);
      expect(responses[0]).toEqual(mockedResponse.data[0].attributes);
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
      const mockedResponseOne: { data: DatasetResource[] } = {
        data: [
          {
            id: '1',
            type: 'dataset',
            attributes: {
              title: 'yellow submarine',
              type: 'feature layer'
            }
          }
        ],
        meta: {
          next: 'next_url'
        }
      } as unknown as { data: DatasetResource[] }

      const mockedResponseTwo: { data: DatasetResource[] } = {
        data: [
          {
            id: '2',
            type: 'dataset',
            attributes: {
              title: 'yellow submarine',
              type: 'table'
            }
          }
        ],
      }

      mockedSearchDatasets.mockResolvedValueOnce(mockedResponseOne);
      fetch.mockResolvedValueOnce({
        json: async () => await mockedResponseTwo 
      });

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
      expect(mockedSearchDatasets).toBeCalledTimes(1);
      expect(mockedSearchDatasets).toHaveBeenNthCalledWith(1, request);
      expect(fetch).toBeCalledTimes(1);
      expect(fetch).toHaveBeenNthCalledWith(1, 'next_url');
      expect(responses).toHaveLength(2);
      expect(responses[0]).toEqual(mockedResponseOne.data[0].attributes);
      expect(responses[1]).toEqual(mockedResponseTwo.data[0].attributes);
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
      const mockedResponseOne: { data: DatasetResource[] } = {
        data: [
          {
            id: '1',
            type: 'dataset',
            attributes: {
              title: 'yellow submarine',
              type: 'feature layer'
            }
          }
        ],
        meta: {
          next: 'next_url'
        }
      } as unknown as { data: DatasetResource[] }

      const mockedResponseTwo: { data: DatasetResource[] } = {
        data: [
          {
            id: '2',
            type: 'dataset',
            attributes: {
              title: 'yellow submarine',
              type: 'table'
            }
          }
        ],
      }
      mockedSearchDatasets.mockResolvedValueOnce(mockedResponseOne);
      fetch.mockResolvedValueOnce({
        json: async () => await mockedResponseTwo 
      });

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
      expect(mockedSearchDatasets).toBeCalledTimes(1);
      expect(mockedSearchDatasets).toHaveBeenNthCalledWith(1, request);
      expect(fetch).toHaveBeenCalledTimes(0);
      expect(responses).toHaveLength(1);
      expect(responses[0]).toEqual(mockedResponseOne.data[0].attributes);
    } catch (err) {
      fail(err);
    }
  });
});