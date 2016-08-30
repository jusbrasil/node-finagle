// @flow

import Promise from 'bluebird';
import Measured from 'measured';

import { RollingHdrHistogram } from './utils/hdr-histogram';

import type Filter from './index';

type HedgeServiceOptions = {
  percentile: number,
  minMs: number,
  histogram: RollingHdrHistogram,
  histogramOptions?: any,
  debug?: boolean
};

export function computeHedgeRequestDelay(
  latencyHistogram: RollingHdrHistogram,
  options: HedgeServiceOptions
): number {
  if (latencyHistogram.hasEnoughData()) {
    const latency = latencyHistogram.percentile(options.percentile);
    return Math.max(latency, options.minMs);
  }

  return -1;
}

export function cancelOthersOnFinish(main: Promise<any>, tied: Promise<any>): void {
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

export function computeLatency(
  promise: Promise<any>,
  timer: Measured.Stopwatch,
  histogram: RollingHdrHistogram
) {
  const compute = () => histogram.record(timer.end());
  promise.then(compute, compute);
}

function printHedgeServiceDiff(mainRequest, hedgeRequest, hedgeDelay, startTime) {
  let endedCount = 0;
  const latencies = {};
  const onFinish = (requestKind) => () => {
    endedCount++;

    const latency = +new Date() - startTime;
    latencies[requestKind] = latency;

    if (endedCount === 2) {
      if (requestKind === 'hedge') {
        console.log('wasted hedge request', latencies);
      } else {
        console.log('hedge request saved time:', latencies);
      }
    }
  };

  mainRequest.then(onFinish('main'), onFinish('main'));
  hedgeRequest.then(onFinish('hedge'), onFinish('hedge'));
}

export default function hedgeRequestFilter<T>(
  options: HedgeServiceOptions,
): Filter<T> {
  const { histogram, histogramOptions, minMs, debug } = options;

  return (service) => {
    const latencyHistogram = histogram || new RollingHdrHistogram(histogramOptions || {});
    return (...input) => {
      const timer = new Measured.Stopwatch();
      const startTime = +(new Date());

      const mainRequest = service(...input);
      computeLatency(mainRequest, timer, latencyHistogram);

      let result = mainRequest;

      const hedgeDelay = computeHedgeRequestDelay(latencyHistogram, options);
      if (hedgeDelay >= minMs) {
        const hedgeRequest = Promise.delay(hedgeDelay).then(() => service(...input));
        cancelOthersOnFinish(mainRequest, hedgeRequest);

        if (debug) {
          printHedgeServiceDiff(mainRequest, hedgeRequest, hedgeDelay, startTime);
        }

        result = Promise.any([mainRequest, hedgeRequest]);
      }

      return result;
    };
  };
}

