// @flow

import Histogram from 'native-hdr-histogram';
import CBuffer from 'CBuffer';

type HistogramOptions = {
  lowest?: number,
  max?: number,
  figures?: number
};

type RollingHdrHistogramInput = {
  windowMs?: number,
  buckets?: number,
  options?: HistogramOptions
}

export class RollingHdrHistogram {
  buffer: CBuffer<Histogram>;
  bufferTime: number;

  histogramSnapshot: Histogram;
  snapshotTime: number;
  options: HistogramOptions;

  constructor({
    options,
    windowMs = 90000,
    buckets = 3,
  }: RollingHdrHistogramInput) {
    this.options = options || {};
    this.histogramSnapshot = null;
    this.snapshotTime = +new Date();
    this.bufferTime = windowMs / buckets;
    this.buffer = new CBuffer(buckets);
    this.buffer.fill(this.createHistogram);
  }

  createHistogram(): Histogram {
    const { lowest, max, figures } = this.options;
    return new Histogram(
      lowest || 1,
      max || 1000,
      figures || 3
    );
  }

  record(value: number) {
    const time = +new Date();
    if (this.snapshotTime + this.bufferTime < time) {
      this.snapshotTime = time;
      this.histogramSnapshot = this.buffer.pop();
      this.buffer.push(this.createHistogram());
    }

    this.buffer.forEach(b => b.record(value));
  }

  hasEnoughData() {
    return this.histogramSnapshot !== null;
  }

  percentile(p: number) {
    return this.histogramSnapshot.percentile(p);
  }
}
