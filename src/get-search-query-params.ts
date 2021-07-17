import { ISearchApiOptions } from "./types";

export const getSearchQueryParams = ({
  query,
  fields,
  filters,
  aggs,
  sort,
  includeFailures,
  onlyFailures,
  pageSize,
  pageNumber
}: ISearchApiOptions) => {
  const params = new URLSearchParams();

  const nested = (parent, child) => `${parent}[${child}]`;

  if (typeof query === 'string' || typeof query === 'number') {
    params.set('q', String(query));
  }

  if (Array.isArray(fields) && !!fields.length) {
    params.set(nested('fields', 'datasets'), fields.join());
  }

  if (typeof filters === 'object') {
    for (const term in filters) {
      params.set(nested('filter', term), filters[term]);
    }
  }

  if (typeof aggs === 'object') {
    for (const term in aggs) {
      params.set(nested('agg', term), String(aggs[term]));
    }
  }

  if (typeof sort === 'object' && typeof sort.field === 'string') {
    params.set('sort', `${sort.order === 'desc' ? '-' : ''}${sort.field}`);
  }

  if (typeof includeFailures === 'boolean') {
    params.set('includeFailures', String(includeFailures));
  }

  if (typeof onlyFailures === 'boolean') {
    params.set('onlyFailures', String(onlyFailures));
  }

  if (typeof pageSize === 'number') {
    params.set(nested('page', 'size'), String(pageSize));
  }

  if (typeof pageNumber === 'number') {
    params.set(nested('page', 'number'), String(pageNumber));
  }

  return params;
};


