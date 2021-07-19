import * as fetchMock from 'fetch-mock-jest';
import * as faker from 'faker';
import { Request } from 'express';
import { HubApiModel } from '../src/model';
import { PagingStream } from "../src/paging-stream";
jest.mock('../src/paging-stream');

describe('HubApiModel', () => {
  // this is just to make the type checker happy
  const MockedPagingStream = PagingStream as unknown as jest.Mock<PagingStream>;

  it('configures and returns a paging stream', async () => {
    const hubSiteUrl = faker.internet.url();

    const model = new HubApiModel({
      defaultSiteUrl: hubSiteUrl
    });

    const req = {
      app: {
        locals: {
          searchOptions: {
            query: faker.random.word()
          }
        }
      }
    } as unknown as Request;

    const stream = model.getStream(req);

    expect(stream).toBeInstanceOf(PagingStream);
    expect(MockedPagingStream).toHaveBeenCalledTimes(1);

    // Now, test the stuff that got passed to PagingStream
    const {
      firstPage,
      loadPage,
      streamPage,
      getNextPage
   } = MockedPagingStream.mock.calls[0][0];

    // Test firstPage
    const firstUrl = new URL(firstPage);
    expect(firstUrl.origin).toBe(hubSiteUrl);
    expect(firstUrl.pathname).toBe('/api/v3/datasets');
    expect(firstUrl.searchParams.get('q')).toBe(req.app.locals.searchOptions.query);

    // Test loadPage
    // Set up fetch-mock

    const pageUrl = faker.internet.url();
    const fakeResponse = {
      data: [
        { id: faker.datatype.uuid() }
      ]
    };
    fetchMock.mock(pageUrl, JSON.stringify(fakeResponse));
    expect(await loadPage(pageUrl)).toEqual(fakeResponse);

    // Test streamPage
    const mockPage = {
      data: [
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() }
      ],
      links: {
        next: faker.internet.url()
      }
    };
    const pushMock = jest.fn();
    streamPage(mockPage, pushMock);

    mockPage.data.forEach(
      (dataset, i) => expect(pushMock).toHaveBeenNthCalledWith(i+1, dataset)
    );

    // Test getNextPage
    expect(getNextPage(mockPage)).toBe(mockPage.links.next);
  });
});
