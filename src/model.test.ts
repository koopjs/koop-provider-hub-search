import * as faker from 'faker';
import { Request } from 'express';
import { HubApiModel } from '../src/model';
import { PagingStream } from "../src/paging-stream";
import { searchContent } from "@esri/hub-search";
import { IContentSearchRequest, IContentSearchResponse } from './types';
jest.mock('../src/paging-stream');
jest.mock('@esri/hub-search');

describe('HubApiModel', () => {
  // this is just to make the type checker happy
  const MockedPagingStream = PagingStream as unknown as jest.Mock<PagingStream>;
  const mockedSearchContent = searchContent as unknown as jest.MockedFunction<typeof searchContent>;

  it('configures and returns a paging stream', async () => {
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms: faker.random.words()
      },
      options: {
        portal: 'https://qaext.arcgis.com'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    const stream = model.getStream(req);

    expect(stream).toBeInstanceOf(PagingStream);
    expect(MockedPagingStream).toHaveBeenCalledTimes(1);

    // Now, test the stuff that got passed to PagingStream
    const {
      firstPageParams,
      loadPage,
      streamPage,
      getNextPageParams
   } = MockedPagingStream.mock.calls[0][0];

    // Test firstPageParams
    expect(firstPageParams.filter.terms).toBe(searchRequest.filter.terms);
    expect(firstPageParams.options.portal).toBe(searchRequest.options.portal);

    // Test loadPage
    mockedSearchContent.mockResolvedValue('VALUE FROM SEARCH CONTENT' as unknown as IContentSearchResponse);

    const paramsWithNext = {
      next: jest.fn().mockResolvedValue('VALUE FROM NEXT')
    };
    expect(await loadPage(paramsWithNext)).toBe('VALUE FROM NEXT');
    expect(paramsWithNext.next).toHaveBeenCalledTimes(1);

    const paramsWithoutNext = {
      foo: 'bar'
    };
    expect(await loadPage(paramsWithoutNext)).toBe('VALUE FROM SEARCH CONTENT');
    expect(mockedSearchContent).toHaveBeenCalledWith(paramsWithoutNext);

    // Test streamPage
    const mockPage = {
      results: [
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() }
      ]
    } as IContentSearchResponse;
    const pushMock = jest.fn();
    streamPage(mockPage, pushMock);

    mockPage.results.forEach(
      (dataset, i) => expect(pushMock).toHaveBeenNthCalledWith(i+1, dataset)
    );

    // Test getNextPageParams
    const withNextPage = {
      hasNext: true,
      next: () => {}
    } as IContentSearchResponse;

    expect(getNextPageParams(withNextPage)).toBe(withNextPage.next);

    const withoutNextPage = {
      hasNext: false
    } as IContentSearchResponse;

    expect(getNextPageParams(withoutNextPage)).toBeFalsy();
  });

  it('defaults portal URL to https://www.arcgis.com', async () => {
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms: faker.random.words()
      },
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    const stream = model.getStream(req);

    expect(stream).toBeInstanceOf(PagingStream);
    expect(MockedPagingStream).toHaveBeenCalledTimes(1);

    const { firstPageParams } = MockedPagingStream.mock.calls[0][0];

    // Test firstPageParams
    expect(firstPageParams.filter.terms).toBe(searchRequest.filter.terms);
    expect(firstPageParams.options.portal).toBe('https://www.arcgis.com');
  });
});
