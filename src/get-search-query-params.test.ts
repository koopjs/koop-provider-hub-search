import { getSearchQueryParams } from "./get-search-query-params";

describe('getSearchQueryParams', () => {
  it('includes a search query', () => {
    const options = {
      query: 'foobar'
    };

    const params = getSearchQueryParams(options);

    expect(params.get('q')).toBe('foobar');
  });

  it('applies a sparse fieldset', () => {
    const options = {
      fields: ['id', 'description', 'name']
    };

    const params = getSearchQueryParams(options);

    expect(params.get('fields[datasets]')).toBe('id,description,name');
  });

  it('ignores empty fieldset array', () => {
    const options = {
      fields: []
    };

    const params = getSearchQueryParams(options);

    expect(params.get('fields[datasets]')).toBeNull();
  });

  it('applies filters', () => {
    const options = {
      filters: {
        tags: 'any(esri,boundaries)',
        bbox: 'intersects(-77.342,38.855,-76.709,38.949)'
      }
    };

    const params = getSearchQueryParams(options);

    expect(params.get('filter[tags]')).toBe('any(esri,boundaries)');
    expect(params.get('filter[bbox]')).toBe('intersects(-77.342,38.855,-76.709,38.949)');
  });

  it('applies aggregations', () => {
    const options = {
      aggs: {
        fields: 'source',
        size: 10
      }
    };

    const params = getSearchQueryParams(options);

    expect(params.get('agg[fields]')).toBe('source');
    expect(params.get('agg[size]')).toBe('10');
  });

  it('applies sorting field', () => {
    const params = getSearchQueryParams({
      sort: {
        field: 'name',
      }
    });

    expect(params.get('sort')).toBe('name');

    const paramsDesc = getSearchQueryParams({
      sort: {
        field: 'name',
        order: 'desc'
      }
    });

    expect(paramsDesc.get('sort')).toBe('-name');
  });

  it('applies includeFailures', () => {
    const params = getSearchQueryParams({
      includeFailures: true
    });

    expect(params.get('includeFailures')).toBe('true');
  });

  it('applies onlyFailures', () => {
    const params = getSearchQueryParams({
      onlyFailures: true
    });

    expect(params.get('onlyFailures')).toBe('true');
  });

  it('applies page size', () => {
    const params = getSearchQueryParams({
      pageSize: 7
    });

    expect(params.get('page[size]')).toBe('7');
  });

  it('applies page number', () => {
    const params = getSearchQueryParams({
      pageNumber: 3
    });

    expect(params.get('page[number]')).toBe('3');
  });

  it('generates a full query', () => {
    const params = getSearchQueryParams({
      query: 'myquery',
      fields: ['id', 'name', 'description', 'culture'],
      filters: {
        'groupIds': '47dd57c9a59d458c86d3d6b978560088'
      },
      aggs: {
        size: 20
      },
      sort: {
        field: 'culture',
        order: 'asc'
      },
      includeFailures: false,
      pageSize: 5,
      pageNumber: 20
    });

    expect(params.get('q')).toBe('myquery');
    expect(params.get('fields[datasets]')).toBe('id,name,description,culture');
    expect(params.get('filter[groupIds]')).toBe('47dd57c9a59d458c86d3d6b978560088');
    expect(params.get('agg[size]')).toBe('20');
    expect(params.get('sort')).toBe('culture');
    expect(params.get('includeFailures')).toBe('false');
    expect(params.get('page[size]')).toBe('5');
    expect(params.get('page[number]')).toBe('20');
  });
});