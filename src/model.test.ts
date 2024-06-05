import * as faker from 'faker';
import * as _ from 'lodash';
import { Request } from 'express';
import { HubApiModel } from '../src/model';
import { PagingStream } from "../src/paging-stream";
import { IBooleanOperator, IContentSearchRequest, SortDirection } from "@esri/hub-search";
import { PassThrough, pipeline } from 'stream';
import { getBatchedStreams } from './helpers/get-batched-streams';
import { promisify } from 'util';
import { fetchSiteModel, hubApiRequest, lookupDomain, RemoteServerError } from '@esri/hub-common';

jest.mock('@esri/hub-search');
jest.mock('./helpers/get-batched-streams');
jest.mock('@esri/hub-common', () => ({
  ...(jest.requireActual('@esri/hub-common') as object),
  hubApiRequest: jest.fn(),
  lookupDomain: jest.fn(),
  fetchSiteModel: jest.fn()
}));

describe('HubApiModel', () => {
  // this is just to make the type checker happy
  const mockGetBatchStreams = getBatchedStreams as unknown as jest.MockedFunction<typeof getBatchedStreams>;
  const mockHubApiRequest = hubApiRequest as unknown as jest.MockedFunction<typeof hubApiRequest>;
  const mockLookupDomain = lookupDomain as unknown as jest.MockedFunction<typeof lookupDomain>;
  const mockFetchSite = fetchSiteModel as unknown as jest.MockedFunction<typeof fetchSiteModel>;

  beforeEach(() => {
    mockGetBatchStreams.mockReset();
    mockHubApiRequest.mockReset();
    mockLookupDomain.mockResolvedValue({
      "id": "374730",
      "hostname": "download-test-qa-pre-a-hub.hubqa.arcgis.com",
      "siteId": "6250d80d445740cc83e03a15d72229b5",
      "clientKey": "lynU5vV3hIra11jA",
      "orgKey": "qa-pre-a-hub",
      "siteTitle": "download Sidebar",
      "orgId": "Xj56SBi2udA78cC9",
      "orgTitle": "QA Premium Alpha Hub",
      "createdAt": "2021-02-12T00:23:44.798Z",
      "updatedAt": "2021-02-26T16:16:13.300Z",
      "sslOnly": true,
      "permanentRedirect": false,
    });
  });

  it('configures and returns a zipped concatenation of batched paging streams', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();

    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        portal: 'https://qaext.arcgis.com',
        fields: ''
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    const searchRequestBodyWithRequiredFields: IContentSearchRequest = _.cloneDeep(searchRequestBody);
    if (searchRequestBodyWithRequiredFields.options) searchRequestBodyWithRequiredFields.options.fields = 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary'
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
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(
        1,
        {
          request: searchRequestBodyWithRequiredFields,
          orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
          orgTitle: "QA Premium Alpha Hub",
          portalUrl: "https://devext.arcgis.com",
          limit: undefined,
          siteUrl: undefined
        }
      );
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

  it('combines streams sequentially in order if sort options are given', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();

    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        portal: 'https://qaext.arcgis.com',
        sortField: 'Date Created|created|modified',
        sortOrder: SortDirection.asc
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
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
    const searchRequestBodyWithRequiredFields: IContentSearchRequest = _.cloneDeep(searchRequestBody);
    if (searchRequestBodyWithRequiredFields.options) searchRequestBodyWithRequiredFields.options.fields = 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary'

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
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(
        1,
        {
          request: searchRequestBodyWithRequiredFields,
          orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
          orgTitle: "QA Premium Alpha Hub",
          portalUrl: "https://devext.arcgis.com",
          limit: undefined,
          siteUrl: undefined
        }
      );

      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
      expect(actualResponses[0]).toEqual(mockedResponses[0][0][0]);
      expect(actualResponses[1]).toEqual(mockedResponses[0][0][1]);
      expect(actualResponses[2]).toEqual(mockedResponses[0][0][2]);
      expect(actualResponses[3]).toEqual(mockedResponses[0][1][0]);
      expect(actualResponses[4]).toEqual(mockedResponses[0][1][1]);
      expect(actualResponses[5]).toEqual(mockedResponses[0][1][2]);
      expect(actualResponses[6]).toEqual(mockedResponses[1][0][0]);
      expect(actualResponses[7]).toEqual(mockedResponses[1][0][1]);
      expect(actualResponses[8]).toEqual(mockedResponses[1][0][2]);
      expect(actualResponses[9]).toEqual(mockedResponses[1][1][0]);
      expect(actualResponses[10]).toEqual(mockedResponses[1][1][1]);
      expect(actualResponses[11]).toEqual(mockedResponses[1][1][2]);
      expect(actualResponses[12]).toEqual(mockedResponses[2][0][0]);
      expect(actualResponses[13]).toEqual(mockedResponses[2][0][1]);
      expect(actualResponses[14]).toEqual(mockedResponses[2][0][2]);
      expect(actualResponses[15]).toEqual(mockedResponses[2][1][0]);
      expect(actualResponses[16]).toEqual(mockedResponses[2][1][1]);
      expect(actualResponses[17]).toEqual(mockedResponses[2][1][2]);
    } catch (err) {
      fail(err);
    }
  });

  it('returns batched streams based on the limit query', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();

    const model = new HubApiModel();
    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        portal: 'https://qaext.arcgis.com'
      },
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 1;
    const pagesPerBatch = 1;
    const resultsPerPage = 8

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
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
      expect(actualResponses[0]).toEqual(mockedResponses[0][0][0]);
      expect(actualResponses[1]).toEqual(mockedResponses[0][0][1]);
      expect(actualResponses[2]).toEqual(mockedResponses[0][0][2]);
      expect(actualResponses[3]).toEqual(mockedResponses[0][0][3]);
      expect(actualResponses[4]).toEqual(mockedResponses[0][0][4]);
      expect(actualResponses[5]).toEqual(mockedResponses[0][0][5]);
      expect(actualResponses[6]).toEqual(mockedResponses[0][0][6]);
      expect(actualResponses[7]).toEqual(mockedResponses[0][0][7]);
    } catch (err) {
      fail(err);
    }
  });

  it('defaults portal URL to https://www.arcgis.com', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
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
    mockHubApiRequest.mockResolvedValue(['id']);

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
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1,
        {
          request: {
            filter: {
              terms,
              id
            },
            options: {
              fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
              portal: 'https://www.arcgis.com'
            }
          },
          siteUrl: undefined,
          limit: undefined,
          orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
          orgTitle: "QA Premium Alpha Hub",
          portalUrl: "https://devext.arcgis.com"
        }
      );

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
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

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
        request: {
          filter: {
            terms,
            id
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('can handle 0 batches when sort fields are applied', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        portal: 'https://qaext.arcgis.com',
        sortField: 'Date Created|created|modified',
        sortOrder: SortDirection.asc
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

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
        request: {
          filter: {
            terms,
            id
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://qaext.arcgis.com',
            sortField: 'Date Created|created|modified',
            sortOrder: SortDirection.asc
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      console.error(err);
      fail(err);
    }
  });

  it('should generate orgBaseUrl if dev portal url is supplied', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;


    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

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
        request: {
          filter: {
            terms,
            id
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: 'https://devext.arcgis.com',
        limit: undefined
      });

    } catch (err) {
      fail(err);
    }
  });

  it('should generate orgBaseUrl if qa portal url is supplied', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://qaext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;


    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

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
        request: {
          filter: {
            terms,
            id
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsqa.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: 'https://qaext.arcgis.com',
        limit: undefined
      });

    } catch (err) {
      fail(err);
    }
  });

  it('can handle a request with a valid group', async () => {
    // Setup
    const terms = faker.random.words();
    const group = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        group
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
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
        request: {
          filter: {
            terms,
            group
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });

      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('can handle a request with a valid group array', async () => {
    // Setup
    const terms = faker.random.words();
    const group = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        group: [group]
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
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
        request: {
          filter: {
            terms,
            group: [group]
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('can handle a request with a valid group IContentFilter', async () => {
    // Setup
    const terms = faker.random.words();
    const group = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        group: { bool: IBooleanOperator.AND, value: [group] }
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

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
        request: {
          filter: {
            terms,
            group: { bool: IBooleanOperator.AND, value: [group] }
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('can handle a request with a valid orgid', async () => {
    // Setup
    const terms = faker.random.words();
    const orgid = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        orgid
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
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
        request: {
          filter: {
            terms,
            orgid
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('can handle a request with a valid orgid array', async () => {
    // Setup
    const terms = faker.random.words();
    const orgid = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        orgid: [orgid]
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
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
        request: {
          filter: {
            terms,
            orgid: [orgid]
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('should throw 400 error if fetchSiteModel fails because domain does not exist', async () => {
    // Setup
    const terms = faker.random.words();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id: '12'
      },
      options: {
        site: 'arcgis.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;


    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
    mockFetchSite.mockRejectedValue(new Error('Api Error :: 404'));
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('Api Error :: 404');
      expect(err.status).toEqual(404);
    }
  });

  it('should throw 400 error if fetchSiteModel fails because site is private', async () => {
    // Setup
    const terms = faker.random.words();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id: '12'
      },
      options: {
        site: 'arcgis.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } },
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;


    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
    const err =  {
      response: {
        error: {
          code: 403
        }
      },
      message: 'error'
    };
    mockFetchSite.mockRejectedValue(err);
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.status).toEqual(404);
    }
  });

  it('should throw 500 error if fetchSiteModel fails', async () => {
    // Setup
    const terms = faker.random.words();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id: '12'
      },
      options: {
        site: 'arcgis.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
    mockFetchSite.mockRejectedValue(new Error('Api Error'));
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('Api Error');
      expect(err.status).toEqual(500);
    }
  });

  it('can handle a request with a valid orgid IContentFilter', async () => {
    // Setup
    const terms = faker.random.words();
    const orgid = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        orgid: { bool: IBooleanOperator.AND, value: [orgid] }
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
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
        request: {
          filter: {
            terms,
            orgid: { bool: IBooleanOperator.AND, value: [orgid] }
          },
          options: {
            fields: 'id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://www.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
      expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
    } catch (err) {
      fail(err);
    }
  });

  it('throws error with an empty request', async () => {
    // Setup
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {};
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('The request must have at least one of the following filters: "id", "group", "orgid". If you provided a "site" option, ensure the site catalog has group and/or org information')
    }
  });

  it('throws error with an null group and orgid', async () => {
    // Setup
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        group: null,
        orgid: null
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('The request must have at least one of the following filters: "id", "group", "orgid". If you provided a "site" option, ensure the site catalog has group and/or org information')
    }
  });

  it('throws error with an empty-string group and orgid', async () => {
    // Setup
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        group: '',
        orgid: ''
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('The request must have at least one of the following filters: "id", "group", "orgid". If you provided a "site" option, ensure the site catalog has group and/or org information')
    }
  });

  it('throws error with an empty group and orgid', async () => {
    // Setup
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        group: [],
        orgid: []
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('The request must have at least one of the following filters: "id", "group", "orgid". If you provided a "site" option, ensure the site catalog has group and/or org information')
    }
  });

  it('throws error with an invalid group and orgid typed as IContentFilters', async () => {
    // Setup
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        group: { bool: IBooleanOperator.AND, value: null },
        orgid: { bool: IBooleanOperator.AND, value: null },
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } },
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);

    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('The request must have at least one of the following filters: "id", "group", "orgid". If you provided a "site" option, ensure the site catalog has group and/or org information')
    }
  });

  it('throws error with an empty group and orgid typed as IContentFilters', async () => {
    // Setup
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        group: { bool: IBooleanOperator.AND, value: [] },
        orgid: { bool: IBooleanOperator.AND, value: [] },
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } },
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    mockGetBatchStreams.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    mockHubApiRequest.mockResolvedValue(['id']);
    try {
      const actualResponses = [];
      const stream = await model.getStream(req);
      const pass = new PassThrough({ objectMode: true });
      pass.on('data', data => {
        actualResponses.push(data);
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);

      fail('should not reach here!');
    } catch (err) {
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(0);
      expect(err.message).toEqual('The request must have at least one of the following filters: "id", "group", "orgid". If you provided a "site" option, ensure the site catalog has group and/or org information')
    }
  });

  it('can validate and handle specified fields', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        portal: 'https://qaext.arcgis.com',
        fields: 'name'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
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
    mockHubApiRequest.mockResolvedValue(['name']);

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
      expect(mockGetBatchStreams).toHaveBeenNthCalledWith(1, {
        request: {
          filter: {
            terms,
            id
          },
          options: {
            fields: 'name,id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
            portal: 'https://qaext.arcgis.com'
          }
        },
        siteUrl: undefined,
        orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
        orgTitle: "QA Premium Alpha Hub",
        portalUrl: "https://devext.arcgis.com",
        limit: undefined
      });
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
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        fields: 'id,dummyField,dummyFieldTwo'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
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

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms
      },
      options: {
        fields: 'name',
        site: 'opendata.de.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;
    const mockSiteModel = {
      data: {
        catalog: {
          groups: ['12345', '34567'],
          orgId: '23456'
        }
      },
      item: {} as any
    }
    mockFetchSite.mockImplementation(() => Promise.resolve(mockSiteModel));

    mockHubApiRequest.mockImplementation(() => Promise.resolve(['name']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

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
      request: {
        filter: {
          terms,
          group: ['12345', '34567'],
          orgid: '23456'
        },
        options: {
          fields: 'name,id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
          site: 'opendata.de.com',
          portal: 'https://www.arcgis.com'
        }
      },
      orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
      orgTitle: "QA Premium Alpha Hub",
      portalUrl: "https://devext.arcgis.com",
      siteUrl: undefined,
      limit: undefined
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('fetches the site catalog and only overrides the orgid if groups are explicitly provided', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        group: ['abcdef', 'ghijkl']
      },
      options: {
        fields: 'name',
        site: 'opendata.de.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;

    mockHubApiRequest.mockImplementation(() => Promise.resolve(['name']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

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
      request: {
        filter: {
          terms,
          group: ['abcdef', 'ghijkl'],
          orgid: '23456'
        },
        options: {
          fields: 'name,id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
          site: 'opendata.de.com',
          portal: 'https://www.arcgis.com'
        }
      },
      orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
      orgTitle: "QA Premium Alpha Hub",
      portalUrl: 'https://devext.arcgis.com',
      siteUrl: undefined,
      limit: undefined
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('fetches the site catalog and only overrides the group if orgid is explicitly provided', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        orgid: 'abcdef'
      },
      options: {
        fields: 'name',
        site: 'opendata.de.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['name']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

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
      request: {
        filter: {
          terms,
          group: ['12345', '34567'],
          orgid: 'abcdef'
        },
        options: {
          fields: 'name,id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
          site: 'opendata.de.com',
          portal: 'https://www.arcgis.com'
        }
      },
      orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
      orgTitle: "QA Premium Alpha Hub",
      portalUrl: "https://devext.arcgis.com",
      siteUrl: undefined,
      limit: undefined
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('does not fetch the provided site\'s catalog if group and orgid are explicitly provided', async () => {
    // Setup
    const terms = faker.random.words()
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        orgid: 'abcdef',
        group: ['12345']
      },
      options: {
        fields: 'name',
        site: 'opendata.de.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
    } as unknown as Request;

    // Mock
    const batches = 0;
    const pagesPerBatch = 0;
    const resultsPerPage = 0;
    mockHubApiRequest.mockImplementation(() => Promise.resolve(['name']));
    mockGetBatchStreams.mockImplementationOnce(() => Promise.resolve([]));

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
      request: {
        filter: {
          terms,
          group: ['12345'],
          orgid: 'abcdef'
        },
        options: {
          fields: 'name,id,type,slug,access,size,licenseInfo,structuredLicense,boundary',
          site: 'opendata.de.com',
          portal: 'https://www.arcgis.com'
        }
      },
      orgBaseUrl: "https://qa-pre-a-hub.mapsdev.arcgis.com",
      orgTitle: "QA Premium Alpha Hub",
      portalUrl: "https://devext.arcgis.com",
      siteUrl: undefined,
      limit: undefined
    });
    expect(actualResponses).toHaveLength(batches * pagesPerBatch * resultsPerPage);
  });

  it('stops non-sequential stream and throws error if underlying paging stream throws error', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        portal: 'https://qaext.arcgis.com'
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
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

  it('stops sequential stream and emits error if underlying paging stream throws error', async () => {
    // Setup
    const terms = faker.random.words();
    const id = faker.datatype.uuid();
    const model = new HubApiModel();

    const searchRequestBody: IContentSearchRequest = {
      filter: {
        terms,
        id
      },
      options: {
        portal: 'https://qaext.arcgis.com',
        sortField: 'Date Created|created|modified',
      }
    };
    const req = {
      app: { locals: { arcgisPortal: 'https://devext.arcgis.com' } }, 
      res: {
        locals: {
          searchRequestBody
        }
      },
      query: {}
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

      pass.on('error', err => {
        expect(err.message).toEqual('Error fetching data!');
      });
      const pipe = promisify(pipeline);

      await pipe(stream, pass);
      
      fail('Should never reach here')
    } catch (err) {
      expect(err.message).toEqual('Error fetching data!');
      expect(mockGetBatchStreams).toHaveBeenCalledTimes(1);
    }
  });

});