// @flow

/* eslint-disable no-param-reassign */

import type { Filter, Service } from './index';

type Cached<Req, Rep> = { request: Req, response: Promise<Rep> };

type CachingOptions<Req, Rep> = {
  cache?: (request: Req) => Map<string, Cached<Req, Rep>>,
  requestKey?: (r: Req) => string,
  diff?: (newReq: Req, oldReq: Req) => ?Req,
  merge?: (newCached: Cached<Req, Rep>, oldCached: Cached<Req, Rep>) => Cached<Req, Rep>,
  mapResponse?: (rep: Promise<Rep>, req: Req) => Promise<Rep>,
  stats?: {
    countCachePartialHit: (req: Req) => void,
    countCacheFullHit: (req: Req) => void,
    countCacheMiss: (req: Req) => void,
  },
};

export default function cachingFilter<Req, Rep>(
  options: CachingOptions<Req, Rep>,
): Filter<Req, Req, Rep, Rep> {
  const {
    requestKey = (r) => JSON.stringify(r),
    diff = () => null,
    merge = (newCached) => newCached,
    mapResponse = (r) => r,
    stats,
  } = options;

  return (service: Service<Req, Rep>) => {
    const defaultCache = new Map();

    return (request: Req) => {
      const cache = options.cache || (() => defaultCache);
      const instCache = cache(request);

      const key = requestKey(request);
      const cached = instCache.get(key);
      if (!cached) {
        if (stats) stats.countCacheMiss(request);

        const response = service(request);
        instCache.set(key, { request, response });
        return response;
      }

      const requestDiff = diff(request, cached.request);
      if (!requestDiff) {
        if (stats) stats.countCacheFullHit(request);
        return cached.response;
      }

      if (stats) stats.countCachePartialHit(request);

      const response = service(requestDiff);
      const finalCached = merge({ request: requestDiff, response }, cached);
      instCache.set(key, finalCached);

      return mapResponse(finalCached.response, request);
    };
  };
}

