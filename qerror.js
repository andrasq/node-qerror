/**
 * fatal error handler, to clean up before exiting
 *
 * 2017-07-07 - AR.
 */

'use strict';

var util = require('util');

function SignalError( message ) {
    Error.call(this, message);
    Error.captureStackTrace(this, SignalError);
    this.message = message;
}
util.inherits(SignalError, Error);

// export the fatal error handler singleton
var qerror = module.exports = new Qerror().install();

function Qerror( ) {
    this.handler = false;               // shutdown handler(err, cb), TBD set by user
    this.timeout = 30000;               // how long to wait for the shutdown handler
    this.alert = defaultAlert;          // set to false to not write notices about fatal errors
    this.install = install;
    this.uninstall = uninstall;

    this._exiting = false;
    this._timeout = false;

    this._handleFatalError = function _handleFatalError( err, message ) {
        message = message || err.message;
        if (this.alert) this.alert(err, message);
        if (this._exiting) {
            process.stdout.write("already exiting, error ignored:" + message + ": " + err + "\n");
            return;
        }
        this._exiting = true;
        var self = this;
        var shutdownTimer;
        function timeoutHandler( ) {
            process.removeListener('uncaughtException', onUncaught);
            self._timeout = true;
            throw new Error("qerror: shutdown handler took more than " + self.timeout + " ms");
        }
        function errorHandlerCallback( err2 ) {
            clearTimeout(shutdownTimer);
            process.removeListener('uncaughtException', onUncaught);
            // NOTE: an error thrown from inside the uncaughtException handler
            // is not relayed to the other uncaughtException handlers.
            // However, signals must be rethrown from the current stack.
            // As a workaround, invoke them ourselves, to not run any code past this error.
            // Calling the other handlers is needed for our unit tests to work.
            if (!self._timeout) {
                if (err instanceof SignalError) throw err;
                else {
                    var funcs = process.listeners('uncaughtException');
                    for (var i=0; i<funcs.length; i++) funcs[i](err);
                }
            }
        }
        var shutdownTimer = setTimeout(timeoutHandler, this.timeout);
        var handler = this.handler || defaultHandler;
        handler(err, errorHandlerCallback);
    }

    // for testing:
    this.SignalError = SignalError;
    this.reset = function reset( ) {
        this.uninstall();
        this.handler = false;
        this.timeout = 30000;
        this._exiting = false;
        this._timeout = false;
        this.install();
    }
}

function defaultAlert( err, msg ) {
    console.log("%s -- fatal error: %s", new Date().toISOString(), msg);
}

function defaultHandler( err, cb ) {
    cb();
}

function onUncaught( err ) {
    qerror._handleFatalError(err, 'uncaught exception');
}

function onHup( ) {
    // HUP is not fatal if someone is handling SIGHUP
    if (process.listeners('SIGHUP').length > 1) return;
    qerror._handleFatalError(new SignalError('SIGHUP'));
}

function onInt( ) {
    qerror._handleFatalError(new SignalError('SIGINT'));
}

function onTerm( ) {
    qerror._handleFatalError(new SignalError('SIGTERM'));
}


function install( ) {
    // make idempotent, remove self if already installed
    this.uninstall();

    process.on('uncaughtException', onUncaught);
    process.on('SIGHUP', onHup);
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    return this;
}

function uninstall( ) {
    process.removeListener('uncaughtException', onUncaught);
    try {
        process.removeListener('SIGHUP', onHup);
        process.removeListener('SIGINT', onInt);
        process.removeListener('SIGTERM', onTerm);
    } catch (err) {
        // cannot remove, ignore error from node v0.10
    }
    return this;
}

// export the pre-installed error handler singleton
module.exports = qerror.install();
