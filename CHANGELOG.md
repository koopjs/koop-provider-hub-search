# CHANGELOG.md

## 3.0.7
Fixed
- Bumped `minimist` version to 1.2.8 which fixes security vulnerability [CVE-2021-44906](https://github.com/advisories/GHSA-xvch-5gv4-984h) [#55](https://github.com/koopjs/koop-provider-hub-search/pull/55)

## 3.0.6
Fixed
- Added default `where` query parameter in accessURL [#53](https://github.com/koopjs/koop-provider-hub-search/pull/53)

## 3.0.5
Fixed
- Timeout issue when sort filter is applied [#51](https://github.com/koopjs/koop-provider-hub-search/pull/51)

## 3.0.4
Added
- Added durable download links for CSV file type [#46](https://github.com/koopjs/koop-provider-hub-search/pull/46)

## 3.0.3
Added
- Added durable download links for CSV, GeoJSON and Shapefile file types [#45](https://github.com/koopjs/koop-provider-hub-search/pull/45)

## 3.0.2
Fixed
- Retrieve `arcgisPortal` from `req.app.locals` [#43](https://github.com/koopjs/koop-provider-hub-search/pull/43)

## 3.0.1
Added
- Added `ownerUri`, `language`, `issuedDateTime`, `orgTitle` and `provenance` data enrichments [#42](https://github.com/koopjs/koop-provider-hub-search/pull/42)

Removed
- Removed redundant `isProxiedCSV` data enrichment [#42](https://github.com/koopjs/koop-provider-hub-search/pull/42)

## 3.0.0
Added
- Added additional data enrichments [#19](https://github.com/koopjs/koop-provider-hub-search/pull/19)
- Transformed Hub dataset response to geoJSON [#20](https://github.com/koopjs/koop-provider-hub-search/pull/20)
- Added CSV access URL for layer dataset [#21](https://github.com/koopjs/koop-provider-hub-search/pull/21)

## 2.1.1
Fixed
- Fixed limit to respect 0 [#13](https://github.com/koopjs/koop-provider-hub-search/pull/13)

## 2.1.0
Added
- Added capability to sort results [#11](https://github.com/koopjs/koop-provider-hub-search/pull/11) and [#12](https://github.com/koopjs/koop-provider-hub-search/pull/12)

## 2.0.1
Added
- Added validation that requires a request scope [#9](https://github.com/koopjs/koop-provider-hub-search/pull/9)

Fixed
- Fixed validation [#10](https://github.com/koopjs/koop-provider-hub-search/pull/10)
- Site property should be examined by provider [#8](https://github.com/koopjs/koop-provider-hub-search/pull/8)

## 1.0.4
Patch
- Return a 400 error response explicitly if a client-provided field is invalid [#7](https://github.com/koopjs/koop-provider-hub-search/pull/7)

## 1.0.3
Fixed
- Fixed stream closing issue when no results are obtained [#6](https://github.com/koopjs/koop-provider-hub-search/pull/6)

## 1.0.2
Added
- Refactored streaming of documents to batch requests to Hub Search simultaneously [#4](https://github.com/koopjs/koop-provider-hub-search/pull/4)

## 1.0.1

Fixed
- README ships to NPM [d8a4fd8](https://github.com/koopjs/koop-provider-hub-search/commit/d8a4fd8f943f75df6af6b3bf0f8c80d56bcb6ebd)


## 1.0.0

Added
- Capability to extract results from Hub Search API [#1](https://github.com/koopjs/koop-provider-hub-search/pull/1)
- Example app to illustrate use of the plugin and assist in local development [#2](https://github.com/koopjs/koop-provider-hub-search/pull/2)
