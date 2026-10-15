
const path = require('path');
for (const fn of ['resolve', 'join']) {
  const orig = path[fn];
  path[fn] = function(...args) {
    for (const a of args) {
      if (typeof a === 'function') {
        console.error('TRACE CAUGHT IN WORKER:', fn, a.name, new Error().stack);
      }
    }
    return orig.apply(this, args);
  };
}
