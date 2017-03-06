node-finagle
=======================

Proof of concept lib of a finagle-like composable `Service`/`Filter` in node.

A `Service` is basically a function `(input) => Promise<output>`

The idea is provide composable wrappers to create smart Services on top of
very simple ones.

Things to support in mind:

- Circuit breaking
- Batchcing
- Batch fork-join
- Retry
- Hedging requests ([more info](https://blog.acolyer.org/2015/01/15/the-tail-at-scale/))


Ideally it should be built on top of proved libraries like `dataloader`, `bluebird` and `generic-pool`


Idea:
```js

val filterStack = (
  FilterStack
    .prepare()
    .andThen(circuitBreaker(/* options */)),
    .andThen(caching(/* options */))
    .andThen(batching(/* options */))
    .andThen(dedup(/* options */))
    .andThen(forkJoin(/* options */)),
    .andThen(hedgeRequest(/* options */)),
);

val loader = filterStack.build((req) => client.loadMany(req.ids));

const x = loader(1);
const y = loader(2);
```


