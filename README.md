qerror
================
[![Build Status](https://travis-ci.org/andrasq/node-qerror.svg?branch=master)](https://travis-ci.org/andrasq/node-qerror)
[![Coverage Status](https://codecov.io/github/andrasq/node-qerror/coverage.svg?branch=master)](https://codecov.io/github/andrasq/node-qerror?branch=master)

error handler hook for fatal signals

`qerror` provides an easy to use hook to install a shutdown handler on receipt of
fatal signals.  Runs the `qerror.handler` function before exiting, letting the app
flush logs and clean up before exiting.  Catches SIGINT, SIGTERM, SIGHUP and uncaught
exceptions, invokes the handler, and rethrows them as errors.

    var qerror = require('qerror');
    qerror.timeout = 30000;
    qerror.handler = function(err, callback) {
        console.log("fatal error, shutting down app:", err.message);
        callback();
    }

    process.kill(process.pid, 'SIGTERM');

outputs

    2017-07-10T02:47:25.545Z -- fatal error: SIGTERM
    fatal error, shutting down app: SIGTERM

    /hd1/home/andras/node/git/qerror/qerror.js:55
                    if (err instanceof SignalError) throw err;
                                                    ^
    Error: SIGTERM
        at process.catchSigterm (/hd1/home/andras/node/git/qerror/qerror.js:102:30)
        at emitNone (events.js:86:13)
        at process.emit (events.js:185:7)
        at Signal.wrap.onsignal (internal/process.js:199:44)


Signals
----------------

- `SIGINT` - fatal, command line kill with ^C
- `SIGTERM` - fatal, the standard way to kill a process
- `SIGHUP` - fatal unless handled.  If this signal is listened for, `qerror` ignores it,
        otherwise it is treated as a fatal error.
- `uncaughtException` - errors not caught by the program are fatal, and terminate
        execution.  `qerror` invokes the shutdown handler on otherwise uncaught errors.

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

### qerror.uninstall( )

Unhook the error handler from the signals and uncaught exceptions.  `qerror` is by
default hooked to SIGINT, SIGTERM, SIGHUP and uncaught exceptions.

### qerror.install( )

Rehook the error handler to the signals and uncaught exceptions.  `qerror` by default
is already `install`-ed.  See `uninstall`.

### qerror._exiting

Internal flag set if a fatal error has been caught and the shutdown handler is
running.  Subsequent errors are suppressed while waiting for the shutdown handler to
call its callback.  To force the app to exit immediately, kill it with SIGKILL.


Todo
----------------
