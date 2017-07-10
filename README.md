qerror
================
[![Build Status](https://travis-ci.org/andrasq/node-qerror.svg?branch=master)](https://travis-ci.org/andrasq/node-qerror)
[![Coverage Status](https://codecov.io/github/andrasq/node-qerror/coverage.svg?branch=master)](https://codecov.io/github/andrasq/node-qerror?branch=master)

error handler hook for fatal signals

`qerror` provides an easy to use hook to install a shutdown handler on receipt of
fatal signals.  Catches SIGINT, SIGTERM and SIGHUP and uncaught exceptions, invokes
the handler, and rethrows the error.

    var qerror = require('qerror');
    qerror.timeout = 30000;
    qerror.handler = function(err, callback) {
        console.log("fatal error, shutting down app:", err);
        callback();
    }


API
----------------

### qerror.handler( err, callback )

A user-provided handler to invoke on fatal error to shut down the running app.
If falsy, the fatal error is rethrown immediately, killing the app.  Default is falsy.

### qerror.alert( err, message )

If set, the function to use to output a notice that a fatal error has occurred.
If falsy, no notice will be output.  The default is a line composed of a timestamp,
"fatal error:" and the error message, eg `2017-07-08T22:18:35 fatal error: SIGTERM`.

### qerror.timeout

How long to allow for the shutdown function to finish before calling its callback, in
milliseconds.  Default is 30000 for 30 seconds.  If this limit is exceeded, an
uncaught error is thrown.


Todo
----------------
