// @flow

import Promise from 'bluebird';
import Measured from 'measured';

import { RollingHdrHistogram } from './utils/hdr-histogram';

import type { Filter, Service } from './index';

type HedgeServiceOptions = {
  percentile: number,
  minMs: number,
  histogram?: RollingHdrHistogram,
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
  histogram: RollingHdrHistogram,
) {
  promise.then(() => {
    const latency = timer.end();
    histogram.record(latency);
  });
}

function printHedgeServiceDiff(mainRequest, hedgeRequest, hedgeDelay, startTime) {
  let endedCount = 0;
  const latencies: any = { hedgeDelay };
  const onFinish = (requestKind) => () => {
    endedCount++;

    const latency = +new Date() - startTime;
    latencies[requestKind] = latency;

    if (endedCount === 1 && latency > hedgeDelay) {
      if (requestKind === 'hedge') {
        // eslint-disable-next-line no-console
        console.log('hedge request saved time:', latencies);
      } else {
        // eslint-disable-next-line no-console
        console.log('wasted hedge request', latencies);
      }
    }
  };

  mainRequest.then(onFinish('main'));
  hedgeRequest.then(onFinish('hedge'));
}

export default function hedgeRequestFilter<Req, Rep>(
  options: HedgeServiceOptions,
): Filter<Req, Req, Rep, Rep> {
  const {
    histogram,
    histogramOptions,
    debug,
    minMs,
  } = options;

  return (service: Service<Req, Rep>) => {
    const latencyHistogram = histogram || new RollingHdrHistogram(histogramOptions || {});
    return (input: Req) => {
      const timer = new Measured.Stopwatch();
      const startTime = +(new Date());

      const mainRequest = Promise.resolve(service(input));
      computeLatency(mainRequest, timer, latencyHistogram);

      let result = mainRequest;

      const hedgeDelay = computeHedgeRequestDelay(latencyHistogram, options);
      if (hedgeDelay >= minMs) {
        const hedgeRequest = Promise.delay(hedgeDelay).then(() => service(input));
        cancelOthersOnFinish(mainRequest, hedgeRequest);

        const hedgeTimer = new Measured.Stopwatch();
        computeLatency(hedgeRequest, hedgeTimer, latencyHistogram);

        if (debug) {
          printHedgeServiceDiff(mainRequest, hedgeRequest, hedgeDelay, startTime);
        }

        result = Promise.any([mainRequest, hedgeRequest]);
      }

      return result;
    };
  };
}

