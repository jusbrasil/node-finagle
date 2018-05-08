// @flow

import forkJoinFilter from '../fork-join';

describe('batching filter', () => {
  it('should fork/join requests', async () => {
    const baseService = jest.fn(
      (items) => Promise.resolve(items.map(i => `${i}!`))
    );

    const finalService = forkJoinFilter({ maxItems: 3, maxBuckets: 10 })(baseService);
    const result = await finalService([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(result).toEqual(['1!', '2!', '3!', '4!', '5!', '6!', '7!', '8!', '9!', '10!']);
    expect(baseService).toHaveBeenCalledTimes(4);
    expect(baseService).toHaveBeenCalledWith([1, 2, 3]);
    expect(baseService).toHaveBeenCalledWith([4, 5, 6]);
    expect(baseService).toHaveBeenCalledWith([7, 8, 9]);
    expect(baseService).toHaveBeenCalledWith([10]);
  });

  it('should not fork when less than the max items per bucket', async () => {
    const baseService = jest.fn(
      (items) => Promise.resolve(items.map(i => `${i}!`))
    );

    const finalService = forkJoinFilter({ maxItems: 5, maxBuckets: 10 })(baseService);
    const result = await finalService([1, 2, 3, 4]);

    expect(result).toEqual(['1!', '2!', '3!', '4!']);
    expect(baseService).toHaveBeenCalledTimes(1);
    expect(baseService).toHaveBeenCalledWith([1, 2, 3, 4]);
  });

  it('should not fork more than max buckets', async () => {
    const baseService = jest.fn(
      (items) => Promise.resolve(items.map(i => `${i}!`))
    );

    const finalService = forkJoinFilter({ maxItems: 3, maxBuckets: 2 })(baseService);
    const result = await finalService([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(result).toEqual(['1!', '2!', '3!', '4!', '5!', '6!', '7!', '8!', '9!', '10!', '11!']);

    expect(baseService).toHaveBeenCalledTimes(2);
    expect(baseService).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6]);
    expect(baseService).toHaveBeenCalledWith([7, 8, 9, 10, 11]);
  });
});
