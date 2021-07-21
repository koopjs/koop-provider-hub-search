import { searchContent } from "@esri/hub-search";

// TODO would be nice to just have these types exported directly from `hub-search`
export type IContentSearchRequest = Parameters<typeof searchContent>[0];

type Unwrap<T> =
	T extends Promise<infer U> ? U :
	T extends (...args: any) => Promise<infer U> ? U :
	T extends (...args: any) => infer U ? U :
	T

export type IContentSearchResponse = Unwrap<ReturnType<typeof searchContent>>;