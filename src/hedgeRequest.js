import Promise from 'bluebird';
import Measured from 'measured';

import type Filter from './index';

type HedgeServiceOptions = {
  percentile: number,
  minMs: number,
  history: Measured.Histogram,
  debug: boolean
};

export function computeHedgeRequestDelay(
  latencyHistogram: Measured.Histogram,
  options: HedgeServiceOptions
): number {
  const { _count: count } = latencyHistogram;

  if (count > 10) {
    const p = options.percentile;
    const latency = latencyHistogram.percentiles([p])[p];
    return Math.max(latency, options.minMs);
  }

  return -1;
}

export function cancelOthersOnFinish(main: Promise<any>, tied: Promise<any>): boolean {
  let finished = false;
  const cancel = (p) => {
    if (!finished) {
      p.cancel();
      finished = true;
    }
  };
  main.then(() => cancel(tied));
  tied.then(() => cancel(main));
}

export function computeLatency(promise, timer, history) {
  const compute = () => history.update(timer.end());
  promise.then(compute, compute);
}

export default function hedgeRequestFilter<T>(
  options: HedgeServiceOptions,
): Filter<T> {
  return (service) => {
    const latencyHistogram = options.history || new Measured.Histogram();
    return (...input) => {
      const timer = new Measured.Stopwatch();

      const mainRequest = service(...input);
      computeLatency(mainRequest, timer, latencyHistogram);

      let result = mainRequest;

      const hedgeDelay = computeHedgeRequestDelay(latencyHistogram, options);
      if (hedgeDelay >= options.minMs) {
        const hedgeRequest = Promise.delay(hedgeDelay).then(() => service(...input));
        cancelOthersOnFinish(mainRequest, hedgeRequest);

        if (options.debug) {
          // printHedgeServiceDiff(mainRequest, hedgeRequest, timer);
        }

        result = Promise.any([mainRequest, hedgeRequest]);
      }


      return result;
    };
  };
}

