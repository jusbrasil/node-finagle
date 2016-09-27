// @flow

import type { Filter, Service } from './index';

type ScatherGathererOptions<Req, Rep> = {
  maxItems: number,
  maxBuckets: number,
  fork: (items: Array<Req>, maxItemsHint: number) => Array<Array<Req>>,
  join: (items: Array<Promise<Array<Rep>>>) => Promise<Array<Rep>>
};

function forkList<Req>(
  inputs: Array<Req>,
  maxItemsHint: number,
): Array<Array<Req>> {
  const buckets = [];
  let curBucket = [];

  inputs.forEach(item => {
    if (curBucket.length >= maxItemsHint) {
      buckets.push(curBucket);
      curBucket = [];
    }
    curBucket.push(item);
  });

  buckets.push(curBucket);
  return buckets;
}

function joinPromisesList<Rep>(promises: Array<Promise<Array<Rep>>>): Promise<Array<Rep>> {
  return (
    Promise
      .all(promises)
      .then(bucketsResponses => [].concat(...bucketsResponses))
  );
}

export default function forkJoinService<Req, Rep>(
  options: ScatherGathererOptions<Req, Rep>
): Filter<Req[], Req[], Rep[], Rep[]> {
  const fork = options.fork || forkList;
  const join = options.join || joinPromisesList;
  const { maxItems, maxBuckets } = options;

  return (service: Service<Req[], Rep[]>) => (inputs: Req[]) => {
    const inputsPerBucket =
      maxBuckets
        ? Math.max(maxItems, Math.floor(inputs.length / maxBuckets))
        : maxItems;

    const groups = fork(inputs, inputsPerBucket);
    return join(groups.map(service));
  };
}
