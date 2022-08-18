# CHANGELOG.md

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
