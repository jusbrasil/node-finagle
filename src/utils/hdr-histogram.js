import Histogram from 'native-hdr-histogram';
import CBuffer from 'CBuffer';

const createHistogram = ({ lowest, max, figures }) => (
  new Histogram(
    lowest || 1,
    max || 1000,
    figures || 3
  )
);

export class RollingHdrHistogram {
  constructor({
    windowMs = 90000,
    buckets = 3,
    options = {},
  }) {
    this.buffer = new CBuffer(buckets);
    this.bufferTime = windowMs / buckets;
    this.histogramSnapshot = null;
    this.snapshotTime = +new Date();

    this.createHistogram = () => createHistogram(options);

    this.buffer.fill(this.createHistogram);
  }

  record(value) {
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

  percentile(p) {
    return this.histogramSnapshot.percentile(p);
  }
}
