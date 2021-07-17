export interface RegistrationOptions {
  defaultSiteUrl: string;
}

export interface ISearchApiOptions {
  /**
   * Fuzzy-search query string
   */
  query?: string;

  /**
   * The fields to include in the responses. Returns all available fields if not included.
   *
   * E.g. ['id', 'description', ...]
   */
  fields?: string[];

  /**
   * The filters to be applied.
   *
   * E.g.
   * {
   *   tags: 'any(esri,boundaries)',
   *   bbox: 'intersects(-77.342,38.855,-76.709,38.949)'
   * }
   */
  filters?: Record<string, string>;

  /**
   * Aggregations.
   *
   * E.g.
   * {
   *   fields: 'source',
   *   size: 10
   * }
   */
  aggs?: Record<string, string|number>;

  /**
   * Sort by a particular field.
   */
  sort?: {
    field: string,
    order?: 'asc'|'desc'
  };

  /**
   * Whether or not to include datasets that failed to compose.
   */
  includeFailures?: boolean;

  /**
   * Whether or not to ONLY include datasets that failed to compose.
   */
  onlyFailures?: boolean;

  /**
   * The size of the pagination. Defaults to 10.
   */
  pageSize?: number;

  /**
   * Which page to begin the query. Defaults to 1.
   */
  pageNumber?: number;
}