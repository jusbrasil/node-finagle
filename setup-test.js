import Promise from 'bluebird';

Promise.config({
  warnings: true,
  longStackTraces: true,
  cancellation: true,
  monitoring: true,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
