'use strict';

var assert = require('assert');
var util = require('util');
var qerror = require('./');

// nyc (test coverage tool) installs a SIGHUP listener, which breaks our tests
//var existingSighupListeners = process.listeners('SIGHUP');
process.removeAllListeners('SIGHUP');


if (!global.setImmediate) global.setImmediate = process.nextTick;



// capture all console output
var outputLines = [];
process.stdout.__sysWrite__ = process.stdout.write;
process.stdout.write = function(msg, a, b) {
    outputLines.push(msg);
    process.stdout.__sysWrite__(msg);
}

function killSelf( sig ) {
    // NOTE: send the kill from a setTimeout.
    // If killed directly from inside a setImmediate, the signal
    // bypasses the sig handler and kills the process dead.
    setTimeout(function(){ process.kill(process.pid, sig) }, 1);
}

var testFuncs = [

    // should invoke handler on uncaught error
    function(done) {
        var err = new Error("some uncaught error");
        qerror.reset();
        var called = false;
        qerror.handler = function(err, cb) { called = err; cb() };
        // NOTE: uncaughtException listener is not invoked when error is thrown from inside an uncaughtException handler
        process.once('uncaughtException', function(err2) {
            assert.equal(err2, err);
            assert.equal(called, err);
            setTimeout(done, 10);
        })
        throw err;
    },

    // should rethrow a fatal error without a handler
    function(done) {
        qerror.reset();
        qerror.handler = false;
        process.once('uncaughtException', function(err) {
            assert.equal(err.message, 'SIGINT');
            assert(outputLines.pop().indexOf('fatal error: SIGINT') >= 0);
            setTimeout(done, 10);
        })
        killSelf('SIGINT');
    },

    // should rethrow the error with a handler
    function(done) {
        qerror.reset();
        qerror.handler = function(err, cb) { cb() };
        process.once('uncaughtException', function(err) {
            assert.equal(err.message, 'SIGINT');
            assert(outputLines.pop().indexOf('fatal error: SIGINT') >= 0);
            setTimeout(done, 10);
        })
        killSelf('SIGINT');
    },

    // should omit alert if disabled
    function(done) {
        qerror.reset();
        outputLines = [];
        qerror.alert = false;
        process.once('uncaughtException', function(err) {
            assert(!outputLines.length || outputLines.pop().indexOf('fatal error: SIGINT') < 0);
            setTimeout(done, 10);
        })
        killSelf('SIGINT');
    },

    // should expose SignalError
    function(done) {
        assert.equal(typeof qerror.SignalError, 'function');
        assert(new qerror.SignalError() instanceof Error);
        done();
    },

    // should invoke handler on SIGINT
    function(done) {
        qerror.reset();
        var called = false;
        qerror.handler = function(err, cb) { called = true; cb() };
        process.once('uncaughtException', function(err) {
            assert(called);
            setTimeout(done, 10);
        })
        killSelf('SIGINT');
    },

    // should invoke handler on SIGTERM
    function(done) {
        qerror.reset();
        var called = false;
        qerror.handler = function(err, cb) { called = true; cb() };
        process.once('uncaughtException', function(err) {
            assert(called);
            setTimeout(done, 10);
        })
        killSelf('SIGTERM');
    },

    // should invoke handler on SIGHUP
    function(done) {
        qerror.reset();
        var called = false;
        qerror.handler = function(err, cb) { called = true; cb() };
        process.once('uncaughtException', function(err) {
            assert(called);
            setTimeout(done, 10);
        })
        killSelf('SIGHUP');
    },

    // should not throw or invoke handler if SIGHUP already listened for
    function(done) {
        qerror.reset();
        var called = false;
        var sighupHandler;
        process.on('SIGHUP', sighupHandler = function() {
            // app SIGHUP handler
        })
        qerror.handler = function(err, cb) { called = true; cb() };
        setTimeout(function(){
            process.removeListener('SIGHUP', sighupHandler);
            assert(!called);
            setTimeout(done, 10);
        }, 10);
        killSelf('SIGHUP');
    },

    // should ignore second error if already shutting down
    function(done) {
        qerror.reset();
        var callCount = 0;
        process.once('uncaughtException', function(err) {
            callCount += 1;
        })
        setTimeout(function(){ killSelf('SIGINT') }, 1);
        setTimeout(function(){ killSelf('SIGINT') }, 2);
        setTimeout(function(){
            assert(callCount == 1);
            done();
        }, 20);
    },

    // should time box handler
    function(done) {
        qerror.reset();
        qerror.timeout = 5;
        qerror.handler = function(err, cb) {
            setTimeout(cb, 10);
        }
        process.once('uncaughtException', function(err) {
            qerror.uninstall();
            assert(err.message.indexOf('qerror:') >= 0, "expected qerror: timeout error");
// FIXME: if not delayed, below errors out wiht "expected same error rethrown"
//            done();
            setTimeout(done, 20);
        })
        killSelf('SIGINT');
    },

    // should trap sighup
    function(done) {
        qerror.reset();
        var err1;
        qerror.handler = function(err, cb) {
            err1 = err;
            assert.equal(err.message, 'SIGHUP', "expected HUP");
            cb();
        }
        process.once('uncaughtException', function(err2) {
            qerror.uninstall();
            assert.equal(err1, err2, "expected same error rethrown");
            done();
        })
        killSelf('SIGHUP');
    },

    // should trap sigterm
    function(done) {
        qerror.reset();
        var err1;
        qerror.handler = function(err, cb) {
            err1 = err;
            cb();
        }
        process.once('uncaughtException', function(err2) {
            assert.equal(err1.message, 'SIGTERM', "expected SIGTERM error");
            assert.equal(err1, err2, "expected same error rethrown");
            done();
        })
        killSelf('SIGTERM');
    },

    function(done) {
        // wait for output to show up
        setTimeout(done, 20);
    },
];

var funcs = testFuncs;
var funcIdx = 0;
(function _iterate(){
    var err;
    if (funcIdx < funcs.length) {
        funcs[funcIdx++](function(e) {
            err = e;
            /*
             * NOTE: this test works under node v0.8 and v0.10, but in node v4 and up
             * (eg v6.10.2) the kill is not caught and delivered to the signal handler
             * if killed from inside a setImmediate.  Works if the loop is iterated with
             * setTimeout, oddly enough.  The kill is delivered if sent from a setTimeout.
             */
            setImmediate(_iterate);
            //setTimeout(_iterate, 1);
        })
    }
    else {
        console.log("AR: Done.");
    }
})();
