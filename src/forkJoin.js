import type Service from './index';

type ScatherGathererOptions = {
  maxItems: number,
  fork: (items: any[]) => any[][],
  join: (items: Promise[]) => Promise
};

export default function forkJoinService<T>(
  options: ScatherGathererOptions,
  service: Service<T>
): Service<T> {
  const fork = options.fork || forkList;
  return (items) => {
    const groups = fork(items, options);
    return join(groups.map(service));
  };
}
