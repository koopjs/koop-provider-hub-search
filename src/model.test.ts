import * as faker from 'faker';
import { Request } from 'express';
import { HubApiModel } from '../src/model';
import { PagingStream } from "../src/paging-stream";
import { IContentSearchRequest } from "@esri/hub-search";
import { PassThrough, pipeline } from 'stream';
import { getBatchedStreams } from './helpers/get-batched-streams';
import { promisify } from 'util';
import { fetchSite, hubApiRequest, RemoteServerError } from '@esri/hub-common';

jest.mock('@esri/hub-search');
jest.mock('./helpers/get-batched-streams');
jest.mock('@esri/hub-common', () => ({
  ...(jest.requireActual('@esri/hub-common') as object),
  hubApiRequest: jest.fn(),
  fetchSite: jest.fn()
}));

describe('HubApiModel', () => {
  // this is just to make the type checker happy
  const mockGetBatchStreams = getBatchedStreams as unknown as jest.MockedFunction<typeof getBatchedStreams>;
  const mockHubApiRequest = hubApiRequest as unknown as jest.MockedFunction<typeof hubApiRequest>;
  const mockFetchSite = fetchSite as unknown as jest.MockedFunction<typeof fetchSite>;

  beforeEach(() => {
    mockGetBatchStreams.mockReset();
    mockHubApiRequest.mockReset();
  });

  it('configures and returns a zipped concatenation of batched paging streams', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
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

    // Mock
    const batches = 3;
    const pagesPerBatch = 2;
    const resultsPerPage = 3

    const mockedResponses = new Array(batches).fill(null).map(() => {
      return new Array(pagesPerBatch).fill(null).map(() => {
        return new Array(resultsPerPage).fill(null).map(() => ({
          id: faker.datatype.uuid()
        }));
      });
    });

    const mockedPagingStreams = mockedResponses.map((batchPages: any[]) => {
      let currPage = 0;
      return new PagingStream({
        firstPageParams: {},
        getNextPageParams: () => {
          if (currPage >= batchPages.length) {
            return null
          } else {
            return () => batchPages[currPage++];
          }
        },
        loadPage: async (params) => {
          if (typeof params === 'function') {
            return params()
          } else {
            return batchPages[currPage++]
          }
        },
        streamPage: (response, push) => {
          response.forEach(result => push(result));
        }
      })
    });

    mockGetBatchStreams.mockResolvedValueOnce(mockedPagingStreams);

    // Test and Assert
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, searchRequest);
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
      expect(actualResponses[0]).toEqual(mockedResponses[0][0][0]);
      expect(actualResponses[1]).toEqual(mockedResponses[0][0][1]);
      expect(actualResponses[2]).toEqual(mockedResponses[0][0][2]);
      expect(actualResponses[3]).toEqual(mockedResponses[1][0][0]);
      expect(actualResponses[4]).toEqual(mockedResponses[1][0][1]);
      expect(actualResponses[5]).toEqual(mockedResponses[1][0][2]);
      expect(actualResponses[6]).toEqual(mockedResponses[2][0][0]);
      expect(actualResponses[7]).toEqual(mockedResponses[2][0][1]);
      expect(actualResponses[8]).toEqual(mockedResponses[2][0][2]);
      expect(actualResponses[9]).toEqual(mockedResponses[0][1][0]);
      expect(actualResponses[10]).toEqual(mockedResponses[0][1][1]);
      expect(actualResponses[11]).toEqual(mockedResponses[0][1][2]);
      expect(actualResponses[12]).toEqual(mockedResponses[1][1][0]);
      expect(actualResponses[13]).toEqual(mockedResponses[1][1][1]);
      expect(actualResponses[14]).toEqual(mockedResponses[1][1][2]);
      expect(actualResponses[15]).toEqual(mockedResponses[2][1][0]);
      expect(actualResponses[16]).toEqual(mockedResponses[2][1][1]);
      expect(actualResponses[17]).toEqual(mockedResponses[2][1][2]);
    } catch (err) {
      fail(err);
    }
  });

  it('defaults portal URL to https://www.arcgis.com', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 3;
    const pagesPerBatch = 2;
    const resultsPerPage = 3

    const mockedResponses = new Array(batches).fill(null).map(() => {
      return new Array(pagesPerBatch).fill(null).map(() => {
        return new Array(resultsPerPage).fill(null).map(() => ({
          id: faker.datatype.uuid()
        }));
      });
    });

    const mockedPagingStreams = mockedResponses.map((batchPages: any[]) => {
      let currPage = 0;
      return new PagingStream({
        firstPageParams: {},
        getNextPageParams: () => {
          if (currPage >= batchPages.length) {
            return null
          } else {
            return () => batchPages[currPage++];
          }
        },
        loadPage: async (params) => {
          if (typeof params === 'function') {
            return params()
          } else {
            return batchPages[currPage++]
          }
        },
        streamPage: (response, push) => {
          response.forEach(result => push(result));
        }
      })
    });

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve(mockedPagingStreams);
    });

    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
        filter: {
          terms
        },
        options: {
          portal: 'https://www.arcgis.com'
        }
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
      expect(actualResponses[0]).toEqual(mockedResponses[0][0][0]);
      expect(actualResponses[1]).toEqual(mockedResponses[0][0][1]);
      expect(actualResponses[2]).toEqual(mockedResponses[0][0][2]);
      expect(actualResponses[3]).toEqual(mockedResponses[1][0][0]);
      expect(actualResponses[4]).toEqual(mockedResponses[1][0][1]);
      expect(actualResponses[5]).toEqual(mockedResponses[1][0][2]);
      expect(actualResponses[6]).toEqual(mockedResponses[2][0][0]);
      expect(actualResponses[7]).toEqual(mockedResponses[2][0][1]);
      expect(actualResponses[8]).toEqual(mockedResponses[2][0][2]);
      expect(actualResponses[9]).toEqual(mockedResponses[0][1][0]);
      expect(actualResponses[10]).toEqual(mockedResponses[0][1][1]);
      expect(actualResponses[11]).toEqual(mockedResponses[0][1][2]);
      expect(actualResponses[12]).toEqual(mockedResponses[1][1][0]);
      expect(actualResponses[13]).toEqual(mockedResponses[1][1][1]);
      expect(actualResponses[14]).toEqual(mockedResponses[1][1][2]);
      expect(actualResponses[15]).toEqual(mockedResponses[2][1][0]);
      expect(actualResponses[16]).toEqual(mockedResponses[2][1][1]);
      expect(actualResponses[17]).toEqual(mockedResponses[2][1][2]);
    } catch (err) {
      fail(err);
    }
  });

  it('can handle 0 batches', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });

    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
        filter: {
          terms
        },
        options: {
          portal: 'https://www.arcgis.com'
        }
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('can handle an empty request', async () => {
    // Setup
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {};
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });

    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
        filter: {},
        options: {
          portal: 'https://www.arcgis.com'
        }
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('can validate and handle specified fields', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
      },
      options: {
        portal: 'https://qaext.arcgis.com',
        fields: 'id'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 3;
    const pagesPerBatch = 2;
    const resultsPerPage = 3

    const mockedResponses = new Array(batches).fill(null).map(() => {
      return new Array(pagesPerBatch).fill(null).map(() => {
        return new Array(resultsPerPage).fill(null).map(() => ({
          id: faker.datatype.uuid()
        }));
      });
    });

    const mockedPagingStreams = mockedResponses.map((batchPages: any[]) => {
      let currPage = 0;
      return new PagingStream({
        firstPageParams: {},
        getNextPageParams: () => {
          if (currPage >= batchPages.length) {
            return null
          } else {
            return () => batchPages[currPage++];
          }
        },
        loadPage: async (params) => {
          if (typeof params === 'function') {
            return params()
          } else {
            return batchPages[currPage++]
          }
        },
        streamPage: (response, push) => {
          response.forEach(result => push(result));
        }
      })
    });

    mockGetBatchStreams.mockResolvedValueOnce(mockedPagingStreams);
    mockHubApiRequest.mockResolvedValue(['id']);

    // Test and Assert
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, searchRequest);
      expect(mockHubApiRequest).toHaveBeenCalledTimes(1);
      expect(mockHubApiRequest).toHaveBeenCalledWith('/fields');
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
      expect(actualResponses[0]).toEqual(mockedResponses[0][0][0]);
      expect(actualResponses[1]).toEqual(mockedResponses[0][0][1]);
      expect(actualResponses[2]).toEqual(mockedResponses[0][0][2]);
      expect(actualResponses[3]).toEqual(mockedResponses[1][0][0]);
      expect(actualResponses[4]).toEqual(mockedResponses[1][0][1]);
      expect(actualResponses[5]).toEqual(mockedResponses[1][0][2]);
      expect(actualResponses[6]).toEqual(mockedResponses[2][0][0]);
      expect(actualResponses[7]).toEqual(mockedResponses[2][0][1]);
      expect(actualResponses[8]).toEqual(mockedResponses[2][0][2]);
      expect(actualResponses[9]).toEqual(mockedResponses[0][1][0]);
      expect(actualResponses[10]).toEqual(mockedResponses[0][1][1]);
      expect(actualResponses[11]).toEqual(mockedResponses[0][1][2]);
      expect(actualResponses[12]).toEqual(mockedResponses[1][1][0]);
      expect(actualResponses[13]).toEqual(mockedResponses[1][1][1]);
      expect(actualResponses[14]).toEqual(mockedResponses[1][1][2]);
      expect(actualResponses[15]).toEqual(mockedResponses[2][1][0]);
      expect(actualResponses[16]).toEqual(mockedResponses[2][1][1]);
      expect(actualResponses[17]).toEqual(mockedResponses[2][1][2]);
    } catch (err) {
      fail(err);
    }
  });

  it('can throw an error with the correct message when an invalid field is specified', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
      },
      options: {
        fields: 'id,dummyField,dummyFieldTwo'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['id']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

    try {
      await model.getStream(req);
      fail('This should not be reached');
    } catch (err) {
      const remoteErr = err as RemoteServerError;
      expect(mockHubApiRequest).toBeCalledTimes(1);
      expect(mockHubApiRequest).toBeCalledWith('/fields')
      expect(mockGetBatchStreams).toBeCalledTimes(0);
      expect(remoteErr.status).toEqual(400)
      expect(remoteErr.message).toEqual('The config has the following invalid entries and cannot be saved: dummyField, dummyFieldTwo')
    }
  });

  it('fetches the site catalog when only a site is provided', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockFetchSite.mockImplementation(() => Promise.resolve({
      data: {
        catalog: {
          groups: ['12345', '34567'],
          orgId: '23456'
        }
      },
      item: {} as any
    }));
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['id']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

    const actualResponses = [];
    const stream = await model.getStream(req);
    const pass = new PassThrough({ objectMode: true });
    pass.on('data', data => {
      actualResponses.push(data);
    });
    const pipe = promisify(pipeline);

    await pipe(stream, pass);

    expect(mockFetchSite).toHaveBeenCalledTimes(1);
    expect(mockFetchSite).toHaveBeenCalledWith('opendata.de.com', {
      authentication: undefined,
      isPortal: undefined,
      hubApiUrl: 'https://hub.arcgis.com',
      portal: 'https://www.arcgis.com/sharing/rest'
    })
    expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
    expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
      filter: {
        terms,
        group: ['12345', '34567'],
        orgid: '23456'
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com',
        portal: 'https://www.arcgis.com'
      }
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('fetches the site catalog and only overrides the orgid if groups are explicitly provided', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms,
        group: ['abcdef', 'ghijkl']
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockFetchSite.mockImplementation(() => Promise.resolve({
      data: {
        catalog: {
          groups: ['12345', '34567'],
          orgId: '23456'
        }
      },
      item: {} as any
    }));
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['id']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

    const actualResponses = [];
    const stream = await model.getStream(req);
    const pass = new PassThrough({ objectMode: true });
    pass.on('data', data => {
      actualResponses.push(data);
    });
    const pipe = promisify(pipeline);

    await pipe(stream, pass);

    expect(mockFetchSite).toHaveBeenCalledTimes(1);
    expect(mockFetchSite).toHaveBeenCalledWith('opendata.de.com', {
      authentication: undefined,
      isPortal: undefined,
      hubApiUrl: 'https://hub.arcgis.com',
      portal: 'https://www.arcgis.com/sharing/rest'
    })
    expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
    expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
      filter: {
        terms,
        group: ['abcdef', 'ghijkl'],
        orgid: '23456'
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com',
        portal: 'https://www.arcgis.com'
      }
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('fetches the site catalog and only overrides the group if orgid is explicitly provided', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms,
        orgid: 'abcdef'
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockFetchSite.mockImplementation(() => Promise.resolve({
      data: {
        catalog: {
          groups: ['12345', '34567'],
          orgId: '23456'
        }
      },
      item: {} as any
    }));
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['id']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

    const actualResponses = [];
    const stream = await model.getStream(req);
    const pass = new PassThrough({ objectMode: true });
    pass.on('data', data => {
      actualResponses.push(data);
    });
    const pipe = promisify(pipeline);

    await pipe(stream, pass);

    expect(mockFetchSite).toHaveBeenCalledTimes(1);
    expect(mockFetchSite).toHaveBeenCalledWith('opendata.de.com', {
      authentication: undefined,
      isPortal: undefined,
      hubApiUrl: 'https://hub.arcgis.com',
      portal: 'https://www.arcgis.com/sharing/rest'
    })
    expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
    expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
      filter: {
        terms,
        group: ['12345', '34567'],
        orgid: 'abcdef'
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com',
        portal: 'https://www.arcgis.com'
      }
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('does not fetch the provided site\'s catalog if group and orgid are explicitly provided', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms,
        orgid: 'abcdef',
        group: ['12345']
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockFetchSite.mockImplementation(() => Promise.resolve({
      data: {
        catalog: {
          groups: ['12345', '34567'],
          orgId: '23456'
        }
      },
      item: {} as any
    }));
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['id']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

    const actualResponses = [];
    const stream = await model.getStream(req);
    const pass = new PassThrough({ objectMode: true });
    pass.on('data', data => {
      actualResponses.push(data);
    });
    const pipe = promisify(pipeline);

    await pipe(stream, pass);

    expect(mockFetchSite).toHaveBeenCalledTimes(0);
    expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
    expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
      filter: {
        terms,
        group: ['12345'],
        orgid: 'abcdef'
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com',
        portal: 'https://www.arcgis.com'
      }
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('can handle when fetchSite returns null', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com'
      }
    };
    const req = {
      res: {
        locals: {
          searchRequest
        }
      }
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockFetchSite.mockImplementation(() => Promise.resolve(null));
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['id']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

    const actualResponses = [];
    const stream = await model.getStream(req);
    const pass = new PassThrough({ objectMode: true });
    pass.on('data', data => {
      actualResponses.push(data);
    });
    const pipe = promisify(pipeline);

    await pipe(stream, pass);

    expect(mockFetchSite).toHaveBeenCalledTimes(1);
    expect(mockFetchSite).toHaveBeenCalledWith('opendata.de.com', {
      authentication: undefined,
      isPortal: undefined,
      hubApiUrl: 'https://hub.arcgis.com',
      portal: 'https://www.arcgis.com/sharing/rest'
    })
    expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
    expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
      filter: {
        terms,
      },
      options: {
        fields: 'id',
        site: 'opendata.de.com',
        portal: 'https://www.arcgis.com'
      }
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('stops streaming and throws error if underlying paging stream throws error', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequest: IContentSearchRequest = {
      filter: {
        terms
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

    // Mock
    const batches = 3;
    const pagesPerBatch = 2;
    const resultsPerPage = 3

    const mockedResponses = new Array(batches).fill(null).map(() => {
      return new Array(pagesPerBatch).fill(null).map(() => {
        return new Array(resultsPerPage).fill(null).map(() => ({
          id: faker.datatype.uuid()
        }));
      });
    });

    const mockedPagingStreams = mockedResponses.map((batchPages: any[], index: number) => {
      let currPage = 0;
      return new PagingStream({
        firstPageParams: {},
        getNextPageParams: () => {
          if (currPage >= batchPages.length) {
            return null
          } else {
            return () => batchPages[currPage++];
          }
        },
        loadPage: async (params) => {
          if (index === 0 && currPage === 0) {
            throw new Error('Error fetching data!')
          } else if (typeof params === 'function') {
            return params()
          } else {
            return batchPages[currPage++]
          }
        },
        streamPage: (response, push) => {
          response.forEach(result => push(result));
        }
      })
    });

    mockGetBatchStreams.mockResolvedValueOnce(mockedPagingStreams);

    const actualResponses = [];

    // Test and Assert
    try {
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);
      fail('Should never reach here')
    } catch (err) {
      expect(err.message).toEqual('Error fetching data!');
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, searchRequest);

      // Each of the other two streams will be able to return their first pages of data
      expect(actualResponses).toHaveLength(6);
      expect(actualResponses[0]).toEqual(mockedResponses[1][0][0]);
      expect(actualResponses[1]).toEqual(mockedResponses[1][0][1]);
      expect(actualResponses[2]).toEqual(mockedResponses[1][0][2]);
      expect(actualResponses[3]).toEqual(mockedResponses[2][0][0]);
      expect(actualResponses[4]).toEqual(mockedResponses[2][0][1]);
      expect(actualResponses[5]).toEqual(mockedResponses[2][0][2]);
    }
  });

  it('getData function does nothing', () => {
    // Setup
    const model = new HubApiModel();

    // Test and Assert
    const data = model.getData();

    expect(data).toBeUndefined();
  });
});
