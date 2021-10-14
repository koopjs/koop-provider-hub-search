import * as faker from "faker";
import { IHubContent } from "@esri/hub-common";
import { IContentSearchRequest, IContentSearchResponse, searchContent } from "@esri/hub-search"
import { fetchTotalResults } from "./fetch-total-results";

jest.mock("@esri/hub-search");

describe('fetchTotalResults function', () => {
  const searchMock = searchContent as unknown as jest.MockedFunction<typeof searchContent>;

  beforeEach(() => {
    searchMock.mockReset();
  });

  it('can successfully fetch results', async () => {
    // Setup
    const randTerms = faker.random.words();
  
    const request: IContentSearchRequest = {
      filter: { terms: randTerms },
      options: { page: 'a page that should not be used' }
    }

    // Mock
    const mockedResponse: IContentSearchResponse = {
      total: 527,
      results: [
        {
          id: '1'
        } as unknown as IHubContent
      ],
      count: 0,
      hasNext: false,
      next: () => null,
      query: 'hello there',
    }

    searchMock.mockImplementation(req => {
      expect(req.filter.terms).toEqual(randTerms);
      expect(req.options.page).toEqual('eyJodWIiOnsic2l6ZSI6MH0sImFnbyI6eyJzaXplIjowfX0=');
      return Promise.resolve(mockedResponse);
    });

    // Test and Assert
    try {
      const actualResponse = await fetchTotalResults(request);

      expect(searchMock).toBeCalledTimes(1);
      expect(searchMock).toHaveBeenNthCalledWith(1, {
        filter: { terms: randTerms },
        options: { page: 'eyJodWIiOnsic2l6ZSI6MH0sImFnbyI6eyJzaXplIjowfX0=' }
      });
      expect(mockedResponse.total).toEqual(actualResponse);
    } catch(err) {
      fail(err);
    }
  })
})