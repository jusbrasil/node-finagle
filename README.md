node-finagle
=======================

Proof of concept lib of a finagle-like composable `Service` in node.

A `Service` is basically a function `(input) => Promise<output>`

The idea is provide composable wrappers to create smart Services on top of
very simple ones.

Things to support in mind:

- Circuit breaking
- Batchcing
- Batch fork-join
- Retry
- Hedging requests ([more info](https://blog.acolyer.org/2015/01/15/the-tail-at-scale/))
- Connection pooling


Ideally it should be built on top of proved libraries like `dataloader`, `bluebird` and `generic-pool`


Idea:
```js

val serviceBuilder = ServiceBuilder.create()
  .andThen(batching)
  .andThen(circuitBreaker({ requiredSuccessRate: 0.90, markDeadSeconds: 5 })),
  .andThen(forkJoin.list({ minBatchSize: 10 })),
  .andThen(hedgeRequest({ percentile: 95, minMs: 5 })),
  .andThen(connectionPooling(pool))

val loader = serviceBuilder((client, batch) => {
  client.doSomething(batch);
});

const x = loader(1);
const y = loader(2);

```


