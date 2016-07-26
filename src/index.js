export type Service<T> = (...input: any) => Promise<T>;

export type Filter<I, O> = (service: Service<I>) => Service<O>;
