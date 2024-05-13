"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/fs-extra/node_modules/universalify/index.js
var require_universalify = __commonJS({
  "../../node_modules/fs-extra/node_modules/universalify/index.js"(exports2) {
    "use strict";
    exports2.fromCallback = function(fn) {
      return Object.defineProperty(function(...args) {
        if (typeof args[args.length - 1] === "function") fn.apply(this, args);
        else {
          return new Promise((resolve4, reject) => {
            fn.call(
              this,
              ...args,
              (err, res) => err != null ? reject(err) : resolve4(res)
            );
          });
        }
      }, "name", { value: fn.name });
    };
    exports2.fromPromise = function(fn) {
      return Object.defineProperty(function(...args) {
        const cb = args[args.length - 1];
        if (typeof cb !== "function") return fn.apply(this, args);
        else fn.apply(this, args.slice(0, -1)).then((r) => cb(null, r), cb);
      }, "name", { value: fn.name });
    };
  }
});

// ../../node_modules/graceful-fs/polyfills.js
var require_polyfills = __commonJS({
  "../../node_modules/graceful-fs/polyfills.js"(exports2, module2) {
    var constants = require("constants");
    var origCwd = process.cwd;
    var cwd = null;
    var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
    process.cwd = function() {
      if (!cwd)
        cwd = origCwd.call(process);
      return cwd;
    };
    try {
      process.cwd();
    } catch (er) {
    }
    if (typeof process.chdir === "function") {
      chdir = process.chdir;
      process.chdir = function(d) {
        cwd = null;
        chdir.call(process, d);
      };
      if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
    }
    var chdir;
    module2.exports = patch;
    function patch(fs9) {
      if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
        patchLchmod(fs9);
      }
      if (!fs9.lutimes) {
        patchLutimes(fs9);
      }
      fs9.chown = chownFix(fs9.chown);
      fs9.fchown = chownFix(fs9.fchown);
      fs9.lchown = chownFix(fs9.lchown);
      fs9.chmod = chmodFix(fs9.chmod);
      fs9.fchmod = chmodFix(fs9.fchmod);
      fs9.lchmod = chmodFix(fs9.lchmod);
      fs9.chownSync = chownFixSync(fs9.chownSync);
      fs9.fchownSync = chownFixSync(fs9.fchownSync);
      fs9.lchownSync = chownFixSync(fs9.lchownSync);
      fs9.chmodSync = chmodFixSync(fs9.chmodSync);
      fs9.fchmodSync = chmodFixSync(fs9.fchmodSync);
      fs9.lchmodSync = chmodFixSync(fs9.lchmodSync);
      fs9.stat = statFix(fs9.stat);
      fs9.fstat = statFix(fs9.fstat);
      fs9.lstat = statFix(fs9.lstat);
      fs9.statSync = statFixSync(fs9.statSync);
      fs9.fstatSync = statFixSync(fs9.fstatSync);
      fs9.lstatSync = statFixSync(fs9.lstatSync);
      if (!fs9.lchmod) {
        fs9.lchmod = function(path10, mode, cb) {
          if (cb) process.nextTick(cb);
        };
        fs9.lchmodSync = function() {
        };
      }
      if (!fs9.lchown) {
        fs9.lchown = function(path10, uid, gid, cb) {
          if (cb) process.nextTick(cb);
        };
        fs9.lchownSync = function() {
        };
      }
      if (platform === "win32") {
        fs9.rename = /* @__PURE__ */ function(fs$rename) {
          return function(from, to, cb) {
            var start = Date.now();
            var backoff = 0;
            fs$rename(from, to, function CB(er) {
              if (er && (er.code === "EACCES" || er.code === "EPERM") && Date.now() - start < 6e4) {
                setTimeout(function() {
                  fs9.stat(to, function(stater, st) {
                    if (stater && stater.code === "ENOENT")
                      fs$rename(from, to, CB);
                    else
                      cb(er);
                  });
                }, backoff);
                if (backoff < 100)
                  backoff += 10;
                return;
              }
              if (cb) cb(er);
            });
          };
        }(fs9.rename);
      }
      fs9.read = function(fs$read) {
        function read(fd, buffer, offset, length, position, callback_) {
          var callback;
          if (callback_ && typeof callback_ === "function") {
            var eagCounter = 0;
            callback = function(er, _, __) {
              if (er && er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                return fs$read.call(fs9, fd, buffer, offset, length, position, callback);
              }
              callback_.apply(this, arguments);
            };
          }
          return fs$read.call(fs9, fd, buffer, offset, length, position, callback);
        }
        if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
        return read;
      }(fs9.read);
      fs9.readSync = /* @__PURE__ */ function(fs$readSync) {
        return function(fd, buffer, offset, length, position) {
          var eagCounter = 0;
          while (true) {
            try {
              return fs$readSync.call(fs9, fd, buffer, offset, length, position);
            } catch (er) {
              if (er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                continue;
              }
              throw er;
            }
          }
        };
      }(fs9.readSync);
      function patchLchmod(fs10) {
        fs10.lchmod = function(path10, mode, callback) {
          fs10.open(
            path10,
            constants.O_WRONLY | constants.O_SYMLINK,
            mode,
            function(err, fd) {
              if (err) {
                if (callback) callback(err);
                return;
              }
              fs10.fchmod(fd, mode, function(err2) {
                fs10.close(fd, function(err22) {
                  if (callback) callback(err2 || err22);
                });
              });
            }
          );
        };
        fs10.lchmodSync = function(path10, mode) {
          var fd = fs10.openSync(path10, constants.O_WRONLY | constants.O_SYMLINK, mode);
          var threw = true;
          var ret;
          try {
            ret = fs10.fchmodSync(fd, mode);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs10.closeSync(fd);
              } catch (er) {
              }
            } else {
              fs10.closeSync(fd);
            }
          }
          return ret;
        };
      }
      function patchLutimes(fs10) {
        if (constants.hasOwnProperty("O_SYMLINK")) {
          fs10.lutimes = function(path10, at, mt, cb) {
            fs10.open(path10, constants.O_SYMLINK, function(er, fd) {
              if (er) {
                if (cb) cb(er);
                return;
              }
              fs10.futimes(fd, at, mt, function(er2) {
                fs10.close(fd, function(er22) {
                  if (cb) cb(er2 || er22);
                });
              });
            });
          };
          fs10.lutimesSync = function(path10, at, mt) {
            var fd = fs10.openSync(path10, constants.O_SYMLINK);
            var ret;
            var threw = true;
            try {
              ret = fs10.futimesSync(fd, at, mt);
              threw = false;
            } finally {
              if (threw) {
                try {
                  fs10.closeSync(fd);
                } catch (er) {
                }
              } else {
                fs10.closeSync(fd);
              }
            }
            return ret;
          };
        } else {
          fs10.lutimes = function(_a, _b, _c, cb) {
            if (cb) process.nextTick(cb);
          };
          fs10.lutimesSync = function() {
          };
        }
      }
      function chmodFix(orig) {
        if (!orig) return orig;
        return function(target, mode, cb) {
          return orig.call(fs9, target, mode, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chmodFixSync(orig) {
        if (!orig) return orig;
        return function(target, mode) {
          try {
            return orig.call(fs9, target, mode);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function chownFix(orig) {
        if (!orig) return orig;
        return function(target, uid, gid, cb) {
          return orig.call(fs9, target, uid, gid, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chownFixSync(orig) {
        if (!orig) return orig;
        return function(target, uid, gid) {
          try {
            return orig.call(fs9, target, uid, gid);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function statFix(orig) {
        if (!orig) return orig;
        return function(target, options, cb) {
          if (typeof options === "function") {
            cb = options;
            options = null;
          }
          function callback(er, stats) {
            if (stats) {
              if (stats.uid < 0) stats.uid += 4294967296;
              if (stats.gid < 0) stats.gid += 4294967296;
            }
            if (cb) cb.apply(this, arguments);
          }
          return options ? orig.call(fs9, target, options, callback) : orig.call(fs9, target, callback);
        };
      }
      function statFixSync(orig) {
        if (!orig) return orig;
        return function(target, options) {
          var stats = options ? orig.call(fs9, target, options) : orig.call(fs9, target);
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          return stats;
        };
      }
      function chownErOk(er) {
        if (!er)
          return true;
        if (er.code === "ENOSYS")
          return true;
        var nonroot = !process.getuid || process.getuid() !== 0;
        if (nonroot) {
          if (er.code === "EINVAL" || er.code === "EPERM")
            return true;
        }
        return false;
      }
    }
  }
});

// ../../node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = __commonJS({
  "../../node_modules/graceful-fs/legacy-streams.js"(exports2, module2) {
    var Stream = require("stream").Stream;
    module2.exports = legacy;
    function legacy(fs9) {
      return {
        ReadStream,
        WriteStream
      };
      function ReadStream(path10, options) {
        if (!(this instanceof ReadStream)) return new ReadStream(path10, options);
        Stream.call(this);
        var self = this;
        this.path = path10;
        this.fd = null;
        this.readable = true;
        this.paused = false;
        this.flags = "r";
        this.mode = 438;
        this.bufferSize = 64 * 1024;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.encoding) this.setEncoding(this.encoding);
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.end === void 0) {
            this.end = Infinity;
          } else if ("number" !== typeof this.end) {
            throw TypeError("end must be a Number");
          }
          if (this.start > this.end) {
            throw new Error("start must be <= end");
          }
          this.pos = this.start;
        }
        if (this.fd !== null) {
          process.nextTick(function() {
            self._read();
          });
          return;
        }
        fs9.open(this.path, this.flags, this.mode, function(err, fd) {
          if (err) {
            self.emit("error", err);
            self.readable = false;
            return;
          }
          self.fd = fd;
          self.emit("open", fd);
          self._read();
        });
      }
      function WriteStream(path10, options) {
        if (!(this instanceof WriteStream)) return new WriteStream(path10, options);
        Stream.call(this);
        this.path = path10;
        this.fd = null;
        this.writable = true;
        this.flags = "w";
        this.encoding = "binary";
        this.mode = 438;
        this.bytesWritten = 0;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.start < 0) {
            throw new Error("start must be >= zero");
          }
          this.pos = this.start;
        }
        this.busy = false;
        this._queue = [];
        if (this.fd === null) {
          this._open = fs9.open;
          this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
          this.flush();
        }
      }
    }
  }
});

// ../../node_modules/graceful-fs/clone.js
var require_clone = __commonJS({
  "../../node_modules/graceful-fs/clone.js"(exports2, module2) {
    "use strict";
    module2.exports = clone;
    var getPrototypeOf = Object.getPrototypeOf || function(obj) {
      return obj.__proto__;
    };
    function clone(obj) {
      if (obj === null || typeof obj !== "object")
        return obj;
      if (obj instanceof Object)
        var copy = { __proto__: getPrototypeOf(obj) };
      else
        var copy = /* @__PURE__ */ Object.create(null);
      Object.getOwnPropertyNames(obj).forEach(function(key) {
        Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
      });
      return copy;
    }
  }
});

// ../../node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = __commonJS({
  "../../node_modules/graceful-fs/graceful-fs.js"(exports2, module2) {
    var fs9 = require("fs");
    var polyfills = require_polyfills();
    var legacy = require_legacy_streams();
    var clone = require_clone();
    var util = require("util");
    var gracefulQueue;
    var previousSymbol;
    if (typeof Symbol === "function" && typeof Symbol.for === "function") {
      gracefulQueue = Symbol.for("graceful-fs.queue");
      previousSymbol = Symbol.for("graceful-fs.previous");
    } else {
      gracefulQueue = "___graceful-fs.queue";
      previousSymbol = "___graceful-fs.previous";
    }
    function noop() {
    }
    function publishQueue(context, queue2) {
      Object.defineProperty(context, gracefulQueue, {
        get: function() {
          return queue2;
        }
      });
    }
    var debug = noop;
    if (util.debuglog)
      debug = util.debuglog("gfs4");
    else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
      debug = function() {
        var m = util.format.apply(util, arguments);
        m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
        console.error(m);
      };
    if (!fs9[gracefulQueue]) {
      queue = global[gracefulQueue] || [];
      publishQueue(fs9, queue);
      fs9.close = function(fs$close) {
        function close(fd, cb) {
          return fs$close.call(fs9, fd, function(err) {
            if (!err) {
              resetQueue();
            }
            if (typeof cb === "function")
              cb.apply(this, arguments);
          });
        }
        Object.defineProperty(close, previousSymbol, {
          value: fs$close
        });
        return close;
      }(fs9.close);
      fs9.closeSync = function(fs$closeSync) {
        function closeSync(fd) {
          fs$closeSync.apply(fs9, arguments);
          resetQueue();
        }
        Object.defineProperty(closeSync, previousSymbol, {
          value: fs$closeSync
        });
        return closeSync;
      }(fs9.closeSync);
      if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
        process.on("exit", function() {
          debug(fs9[gracefulQueue]);
          require("assert").equal(fs9[gracefulQueue].length, 0);
        });
      }
    }
    var queue;
    if (!global[gracefulQueue]) {
      publishQueue(global, fs9[gracefulQueue]);
    }
    module2.exports = patch(clone(fs9));
    if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs9.__patched) {
      module2.exports = patch(fs9);
      fs9.__patched = true;
    }
    function patch(fs10) {
      polyfills(fs10);
      fs10.gracefulify = patch;
      fs10.createReadStream = createReadStream;
      fs10.createWriteStream = createWriteStream;
      var fs$readFile = fs10.readFile;
      fs10.readFile = readFile4;
      function readFile4(path10, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$readFile(path10, options, cb);
        function go$readFile(path11, options2, cb2, startTime) {
          return fs$readFile(path11, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$readFile, [path11, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$writeFile = fs10.writeFile;
      fs10.writeFile = writeFile;
      function writeFile(path10, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$writeFile(path10, data, options, cb);
        function go$writeFile(path11, data2, options2, cb2, startTime) {
          return fs$writeFile(path11, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$writeFile, [path11, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$appendFile = fs10.appendFile;
      if (fs$appendFile)
        fs10.appendFile = appendFile;
      function appendFile(path10, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$appendFile(path10, data, options, cb);
        function go$appendFile(path11, data2, options2, cb2, startTime) {
          return fs$appendFile(path11, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$appendFile, [path11, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$copyFile = fs10.copyFile;
      if (fs$copyFile)
        fs10.copyFile = copyFile;
      function copyFile(src, dest, flags, cb) {
        if (typeof flags === "function") {
          cb = flags;
          flags = 0;
        }
        return go$copyFile(src, dest, flags, cb);
        function go$copyFile(src2, dest2, flags2, cb2, startTime) {
          return fs$copyFile(src2, dest2, flags2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$readdir = fs10.readdir;
      fs10.readdir = readdir7;
      function readdir7(path10, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$readdir(path10, options, cb);
        function go$readdir(path11, options2, cb2, startTime) {
          return fs$readdir(path11, options2, function(err, files) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$readdir, [path11, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (files && files.sort)
                files.sort();
              if (typeof cb2 === "function")
                cb2.call(this, err, files);
            }
          });
        }
      }
      if (process.version.substr(0, 4) === "v0.8") {
        var legStreams = legacy(fs10);
        ReadStream = legStreams.ReadStream;
        WriteStream = legStreams.WriteStream;
      }
      var fs$ReadStream = fs10.ReadStream;
      if (fs$ReadStream) {
        ReadStream.prototype = Object.create(fs$ReadStream.prototype);
        ReadStream.prototype.open = ReadStream$open;
      }
      var fs$WriteStream = fs10.WriteStream;
      if (fs$WriteStream) {
        WriteStream.prototype = Object.create(fs$WriteStream.prototype);
        WriteStream.prototype.open = WriteStream$open;
      }
      Object.defineProperty(fs10, "ReadStream", {
        get: function() {
          return ReadStream;
        },
        set: function(val) {
          ReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(fs10, "WriteStream", {
        get: function() {
          return WriteStream;
        },
        set: function(val) {
          WriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileReadStream = ReadStream;
      Object.defineProperty(fs10, "FileReadStream", {
        get: function() {
          return FileReadStream;
        },
        set: function(val) {
          FileReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileWriteStream = WriteStream;
      Object.defineProperty(fs10, "FileWriteStream", {
        get: function() {
          return FileWriteStream;
        },
        set: function(val) {
          FileWriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      function ReadStream(path10, options) {
        if (this instanceof ReadStream)
          return fs$ReadStream.apply(this, arguments), this;
        else
          return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
      }
      function ReadStream$open() {
        var that = this;
        open(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            if (that.autoClose)
              that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
            that.read();
          }
        });
      }
      function WriteStream(path10, options) {
        if (this instanceof WriteStream)
          return fs$WriteStream.apply(this, arguments), this;
        else
          return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
      }
      function WriteStream$open() {
        var that = this;
        open(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
          }
        });
      }
      function createReadStream(path10, options) {
        return new fs10.ReadStream(path10, options);
      }
      function createWriteStream(path10, options) {
        return new fs10.WriteStream(path10, options);
      }
      var fs$open = fs10.open;
      fs10.open = open;
      function open(path10, flags, mode, cb) {
        if (typeof mode === "function")
          cb = mode, mode = null;
        return go$open(path10, flags, mode, cb);
        function go$open(path11, flags2, mode2, cb2, startTime) {
          return fs$open(path11, flags2, mode2, function(err, fd) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$open, [path11, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      return fs10;
    }
    function enqueue(elem) {
      debug("ENQUEUE", elem[0].name, elem[1]);
      fs9[gracefulQueue].push(elem);
      retry();
    }
    var retryTimer;
    function resetQueue() {
      var now = Date.now();
      for (var i = 0; i < fs9[gracefulQueue].length; ++i) {
        if (fs9[gracefulQueue][i].length > 2) {
          fs9[gracefulQueue][i][3] = now;
          fs9[gracefulQueue][i][4] = now;
        }
      }
      retry();
    }
    function retry() {
      clearTimeout(retryTimer);
      retryTimer = void 0;
      if (fs9[gracefulQueue].length === 0)
        return;
      var elem = fs9[gracefulQueue].shift();
      var fn = elem[0];
      var args = elem[1];
      var err = elem[2];
      var startTime = elem[3];
      var lastTime = elem[4];
      if (startTime === void 0) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args);
      } else if (Date.now() - startTime >= 6e4) {
        debug("TIMEOUT", fn.name, args);
        var cb = args.pop();
        if (typeof cb === "function")
          cb.call(null, err);
      } else {
        var sinceAttempt = Date.now() - lastTime;
        var sinceStart = Math.max(lastTime - startTime, 1);
        var desiredDelay = Math.min(sinceStart * 1.2, 100);
        if (sinceAttempt >= desiredDelay) {
          debug("RETRY", fn.name, args);
          fn.apply(null, args.concat([startTime]));
        } else {
          fs9[gracefulQueue].push(elem);
        }
      }
      if (retryTimer === void 0) {
        retryTimer = setTimeout(retry, 0);
      }
    }
  }
});

// ../../node_modules/fs-extra/lib/fs/index.js
var require_fs = __commonJS({
  "../../node_modules/fs-extra/lib/fs/index.js"(exports2) {
    "use strict";
    var u = require_universalify().fromCallback;
    var fs9 = require_graceful_fs();
    var api = [
      "access",
      "appendFile",
      "chmod",
      "chown",
      "close",
      "copyFile",
      "fchmod",
      "fchown",
      "fdatasync",
      "fstat",
      "fsync",
      "ftruncate",
      "futimes",
      "lchmod",
      "lchown",
      "link",
      "lstat",
      "mkdir",
      "mkdtemp",
      "open",
      "opendir",
      "readdir",
      "readFile",
      "readlink",
      "realpath",
      "rename",
      "rm",
      "rmdir",
      "stat",
      "symlink",
      "truncate",
      "unlink",
      "utimes",
      "writeFile"
    ].filter((key) => {
      return typeof fs9[key] === "function";
    });
    Object.assign(exports2, fs9);
    api.forEach((method) => {
      exports2[method] = u(fs9[method]);
    });
    exports2.realpath.native = u(fs9.realpath.native);
    exports2.exists = function(filename, callback) {
      if (typeof callback === "function") {
        return fs9.exists(filename, callback);
      }
      return new Promise((resolve4) => {
        return fs9.exists(filename, resolve4);
      });
    };
    exports2.read = function(fd, buffer, offset, length, position, callback) {
      if (typeof callback === "function") {
        return fs9.read(fd, buffer, offset, length, position, callback);
      }
      return new Promise((resolve4, reject) => {
        fs9.read(fd, buffer, offset, length, position, (err, bytesRead, buffer2) => {
          if (err) return reject(err);
          resolve4({ bytesRead, buffer: buffer2 });
        });
      });
    };
    exports2.write = function(fd, buffer, ...args) {
      if (typeof args[args.length - 1] === "function") {
        return fs9.write(fd, buffer, ...args);
      }
      return new Promise((resolve4, reject) => {
        fs9.write(fd, buffer, ...args, (err, bytesWritten, buffer2) => {
          if (err) return reject(err);
          resolve4({ bytesWritten, buffer: buffer2 });
        });
      });
    };
    if (typeof fs9.writev === "function") {
      exports2.writev = function(fd, buffers, ...args) {
        if (typeof args[args.length - 1] === "function") {
          return fs9.writev(fd, buffers, ...args);
        }
        return new Promise((resolve4, reject) => {
          fs9.writev(fd, buffers, ...args, (err, bytesWritten, buffers2) => {
            if (err) return reject(err);
            resolve4({ bytesWritten, buffers: buffers2 });
          });
        });
      };
    }
  }
});

// ../../node_modules/fs-extra/lib/mkdirs/utils.js
var require_utils = __commonJS({
  "../../node_modules/fs-extra/lib/mkdirs/utils.js"(exports2, module2) {
    "use strict";
    var path10 = require("path");
    module2.exports.checkPath = function checkPath(pth) {
      if (process.platform === "win32") {
        const pathHasInvalidWinCharacters = /[<>:"|?*]/.test(pth.replace(path10.parse(pth).root, ""));
        if (pathHasInvalidWinCharacters) {
          const error = new Error(`Path contains invalid characters: ${pth}`);
          error.code = "EINVAL";
          throw error;
        }
      }
    };
  }
});

// ../../node_modules/fs-extra/lib/mkdirs/make-dir.js
var require_make_dir = __commonJS({
  "../../node_modules/fs-extra/lib/mkdirs/make-dir.js"(exports2, module2) {
    "use strict";
    var fs9 = require_fs();
    var { checkPath } = require_utils();
    var getMode = (options) => {
      const defaults = { mode: 511 };
      if (typeof options === "number") return options;
      return { ...defaults, ...options }.mode;
    };
    module2.exports.makeDir = async (dir, options) => {
      checkPath(dir);
      return fs9.mkdir(dir, {
        mode: getMode(options),
        recursive: true
      });
    };
    module2.exports.makeDirSync = (dir, options) => {
      checkPath(dir);
      return fs9.mkdirSync(dir, {
        mode: getMode(options),
        recursive: true
      });
    };
  }
});

// ../../node_modules/fs-extra/lib/mkdirs/index.js
var require_mkdirs = __commonJS({
  "../../node_modules/fs-extra/lib/mkdirs/index.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromPromise;
    var { makeDir: _makeDir, makeDirSync } = require_make_dir();
    var makeDir = u(_makeDir);
    module2.exports = {
      mkdirs: makeDir,
      mkdirsSync: makeDirSync,
      // alias
      mkdirp: makeDir,
      mkdirpSync: makeDirSync,
      ensureDir: makeDir,
      ensureDirSync: makeDirSync
    };
  }
});

// ../../node_modules/fs-extra/lib/path-exists/index.js
var require_path_exists = __commonJS({
  "../../node_modules/fs-extra/lib/path-exists/index.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromPromise;
    var fs9 = require_fs();
    function pathExists8(path10) {
      return fs9.access(path10).then(() => true).catch(() => false);
    }
    module2.exports = {
      pathExists: u(pathExists8),
      pathExistsSync: fs9.existsSync
    };
  }
});

// ../../node_modules/fs-extra/lib/util/utimes.js
var require_utimes = __commonJS({
  "../../node_modules/fs-extra/lib/util/utimes.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    function utimesMillis(path10, atime, mtime, callback) {
      fs9.open(path10, "r+", (err, fd) => {
        if (err) return callback(err);
        fs9.futimes(fd, atime, mtime, (futimesErr) => {
          fs9.close(fd, (closeErr) => {
            if (callback) callback(futimesErr || closeErr);
          });
        });
      });
    }
    function utimesMillisSync(path10, atime, mtime) {
      const fd = fs9.openSync(path10, "r+");
      fs9.futimesSync(fd, atime, mtime);
      return fs9.closeSync(fd);
    }
    module2.exports = {
      utimesMillis,
      utimesMillisSync
    };
  }
});

// ../../node_modules/fs-extra/lib/util/stat.js
var require_stat = __commonJS({
  "../../node_modules/fs-extra/lib/util/stat.js"(exports2, module2) {
    "use strict";
    var fs9 = require_fs();
    var path10 = require("path");
    var util = require("util");
    function getStats(src, dest, opts) {
      const statFunc = opts.dereference ? (file) => fs9.stat(file, { bigint: true }) : (file) => fs9.lstat(file, { bigint: true });
      return Promise.all([
        statFunc(src),
        statFunc(dest).catch((err) => {
          if (err.code === "ENOENT") return null;
          throw err;
        })
      ]).then(([srcStat, destStat]) => ({ srcStat, destStat }));
    }
    function getStatsSync(src, dest, opts) {
      let destStat;
      const statFunc = opts.dereference ? (file) => fs9.statSync(file, { bigint: true }) : (file) => fs9.lstatSync(file, { bigint: true });
      const srcStat = statFunc(src);
      try {
        destStat = statFunc(dest);
      } catch (err) {
        if (err.code === "ENOENT") return { srcStat, destStat: null };
        throw err;
      }
      return { srcStat, destStat };
    }
    function checkPaths(src, dest, funcName, opts, cb) {
      util.callbackify(getStats)(src, dest, opts, (err, stats) => {
        if (err) return cb(err);
        const { srcStat, destStat } = stats;
        if (destStat) {
          if (areIdentical(srcStat, destStat)) {
            const srcBaseName = path10.basename(src);
            const destBaseName = path10.basename(dest);
            if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) {
              return cb(null, { srcStat, destStat, isChangingCase: true });
            }
            return cb(new Error("Source and destination must not be the same."));
          }
          if (srcStat.isDirectory() && !destStat.isDirectory()) {
            return cb(new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`));
          }
          if (!srcStat.isDirectory() && destStat.isDirectory()) {
            return cb(new Error(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`));
          }
        }
        if (srcStat.isDirectory() && isSrcSubdir(src, dest)) {
          return cb(new Error(errMsg(src, dest, funcName)));
        }
        return cb(null, { srcStat, destStat });
      });
    }
    function checkPathsSync(src, dest, funcName, opts) {
      const { srcStat, destStat } = getStatsSync(src, dest, opts);
      if (destStat) {
        if (areIdentical(srcStat, destStat)) {
          const srcBaseName = path10.basename(src);
          const destBaseName = path10.basename(dest);
          if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) {
            return { srcStat, destStat, isChangingCase: true };
          }
          throw new Error("Source and destination must not be the same.");
        }
        if (srcStat.isDirectory() && !destStat.isDirectory()) {
          throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
        }
        if (!srcStat.isDirectory() && destStat.isDirectory()) {
          throw new Error(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`);
        }
      }
      if (srcStat.isDirectory() && isSrcSubdir(src, dest)) {
        throw new Error(errMsg(src, dest, funcName));
      }
      return { srcStat, destStat };
    }
    function checkParentPaths(src, srcStat, dest, funcName, cb) {
      const srcParent = path10.resolve(path10.dirname(src));
      const destParent = path10.resolve(path10.dirname(dest));
      if (destParent === srcParent || destParent === path10.parse(destParent).root) return cb();
      fs9.stat(destParent, { bigint: true }, (err, destStat) => {
        if (err) {
          if (err.code === "ENOENT") return cb();
          return cb(err);
        }
        if (areIdentical(srcStat, destStat)) {
          return cb(new Error(errMsg(src, dest, funcName)));
        }
        return checkParentPaths(src, srcStat, destParent, funcName, cb);
      });
    }
    function checkParentPathsSync(src, srcStat, dest, funcName) {
      const srcParent = path10.resolve(path10.dirname(src));
      const destParent = path10.resolve(path10.dirname(dest));
      if (destParent === srcParent || destParent === path10.parse(destParent).root) return;
      let destStat;
      try {
        destStat = fs9.statSync(destParent, { bigint: true });
      } catch (err) {
        if (err.code === "ENOENT") return;
        throw err;
      }
      if (areIdentical(srcStat, destStat)) {
        throw new Error(errMsg(src, dest, funcName));
      }
      return checkParentPathsSync(src, srcStat, destParent, funcName);
    }
    function areIdentical(srcStat, destStat) {
      return destStat.ino && destStat.dev && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev;
    }
    function isSrcSubdir(src, dest) {
      const srcArr = path10.resolve(src).split(path10.sep).filter((i) => i);
      const destArr = path10.resolve(dest).split(path10.sep).filter((i) => i);
      return srcArr.reduce((acc, cur, i) => acc && destArr[i] === cur, true);
    }
    function errMsg(src, dest, funcName) {
      return `Cannot ${funcName} '${src}' to a subdirectory of itself, '${dest}'.`;
    }
    module2.exports = {
      checkPaths,
      checkPathsSync,
      checkParentPaths,
      checkParentPathsSync,
      isSrcSubdir,
      areIdentical
    };
  }
});

// ../../node_modules/fs-extra/lib/copy/copy.js
var require_copy = __commonJS({
  "../../node_modules/fs-extra/lib/copy/copy.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    var path10 = require("path");
    var mkdirs = require_mkdirs().mkdirs;
    var pathExists8 = require_path_exists().pathExists;
    var utimesMillis = require_utimes().utimesMillis;
    var stat5 = require_stat();
    function copy(src, dest, opts, cb) {
      if (typeof opts === "function" && !cb) {
        cb = opts;
        opts = {};
      } else if (typeof opts === "function") {
        opts = { filter: opts };
      }
      cb = cb || function() {
      };
      opts = opts || {};
      opts.clobber = "clobber" in opts ? !!opts.clobber : true;
      opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
      if (opts.preserveTimestamps && process.arch === "ia32") {
        console.warn(`fs-extra: Using the preserveTimestamps option in 32-bit node is not recommended;

    see https://github.com/jprichardson/node-fs-extra/issues/269`);
      }
      stat5.checkPaths(src, dest, "copy", opts, (err, stats) => {
        if (err) return cb(err);
        const { srcStat, destStat } = stats;
        stat5.checkParentPaths(src, srcStat, dest, "copy", (err2) => {
          if (err2) return cb(err2);
          if (opts.filter) return handleFilter(checkParentDir, destStat, src, dest, opts, cb);
          return checkParentDir(destStat, src, dest, opts, cb);
        });
      });
    }
    function checkParentDir(destStat, src, dest, opts, cb) {
      const destParent = path10.dirname(dest);
      pathExists8(destParent, (err, dirExists) => {
        if (err) return cb(err);
        if (dirExists) return getStats(destStat, src, dest, opts, cb);
        mkdirs(destParent, (err2) => {
          if (err2) return cb(err2);
          return getStats(destStat, src, dest, opts, cb);
        });
      });
    }
    function handleFilter(onInclude, destStat, src, dest, opts, cb) {
      Promise.resolve(opts.filter(src, dest)).then((include) => {
        if (include) return onInclude(destStat, src, dest, opts, cb);
        return cb();
      }, (error) => cb(error));
    }
    function startCopy(destStat, src, dest, opts, cb) {
      if (opts.filter) return handleFilter(getStats, destStat, src, dest, opts, cb);
      return getStats(destStat, src, dest, opts, cb);
    }
    function getStats(destStat, src, dest, opts, cb) {
      const stat6 = opts.dereference ? fs9.stat : fs9.lstat;
      stat6(src, (err, srcStat) => {
        if (err) return cb(err);
        if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts, cb);
        else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts, cb);
        else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts, cb);
        else if (srcStat.isSocket()) return cb(new Error(`Cannot copy a socket file: ${src}`));
        else if (srcStat.isFIFO()) return cb(new Error(`Cannot copy a FIFO pipe: ${src}`));
        return cb(new Error(`Unknown file: ${src}`));
      });
    }
    function onFile(srcStat, destStat, src, dest, opts, cb) {
      if (!destStat) return copyFile(srcStat, src, dest, opts, cb);
      return mayCopyFile(srcStat, src, dest, opts, cb);
    }
    function mayCopyFile(srcStat, src, dest, opts, cb) {
      if (opts.overwrite) {
        fs9.unlink(dest, (err) => {
          if (err) return cb(err);
          return copyFile(srcStat, src, dest, opts, cb);
        });
      } else if (opts.errorOnExist) {
        return cb(new Error(`'${dest}' already exists`));
      } else return cb();
    }
    function copyFile(srcStat, src, dest, opts, cb) {
      fs9.copyFile(src, dest, (err) => {
        if (err) return cb(err);
        if (opts.preserveTimestamps) return handleTimestampsAndMode(srcStat.mode, src, dest, cb);
        return setDestMode(dest, srcStat.mode, cb);
      });
    }
    function handleTimestampsAndMode(srcMode, src, dest, cb) {
      if (fileIsNotWritable(srcMode)) {
        return makeFileWritable(dest, srcMode, (err) => {
          if (err) return cb(err);
          return setDestTimestampsAndMode(srcMode, src, dest, cb);
        });
      }
      return setDestTimestampsAndMode(srcMode, src, dest, cb);
    }
    function fileIsNotWritable(srcMode) {
      return (srcMode & 128) === 0;
    }
    function makeFileWritable(dest, srcMode, cb) {
      return setDestMode(dest, srcMode | 128, cb);
    }
    function setDestTimestampsAndMode(srcMode, src, dest, cb) {
      setDestTimestamps(src, dest, (err) => {
        if (err) return cb(err);
        return setDestMode(dest, srcMode, cb);
      });
    }
    function setDestMode(dest, srcMode, cb) {
      return fs9.chmod(dest, srcMode, cb);
    }
    function setDestTimestamps(src, dest, cb) {
      fs9.stat(src, (err, updatedSrcStat) => {
        if (err) return cb(err);
        return utimesMillis(dest, updatedSrcStat.atime, updatedSrcStat.mtime, cb);
      });
    }
    function onDir(srcStat, destStat, src, dest, opts, cb) {
      if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts, cb);
      return copyDir(src, dest, opts, cb);
    }
    function mkDirAndCopy(srcMode, src, dest, opts, cb) {
      fs9.mkdir(dest, (err) => {
        if (err) return cb(err);
        copyDir(src, dest, opts, (err2) => {
          if (err2) return cb(err2);
          return setDestMode(dest, srcMode, cb);
        });
      });
    }
    function copyDir(src, dest, opts, cb) {
      fs9.readdir(src, (err, items) => {
        if (err) return cb(err);
        return copyDirItems(items, src, dest, opts, cb);
      });
    }
    function copyDirItems(items, src, dest, opts, cb) {
      const item = items.pop();
      if (!item) return cb();
      return copyDirItem(items, item, src, dest, opts, cb);
    }
    function copyDirItem(items, item, src, dest, opts, cb) {
      const srcItem = path10.join(src, item);
      const destItem = path10.join(dest, item);
      stat5.checkPaths(srcItem, destItem, "copy", opts, (err, stats) => {
        if (err) return cb(err);
        const { destStat } = stats;
        startCopy(destStat, srcItem, destItem, opts, (err2) => {
          if (err2) return cb(err2);
          return copyDirItems(items, src, dest, opts, cb);
        });
      });
    }
    function onLink(destStat, src, dest, opts, cb) {
      fs9.readlink(src, (err, resolvedSrc) => {
        if (err) return cb(err);
        if (opts.dereference) {
          resolvedSrc = path10.resolve(process.cwd(), resolvedSrc);
        }
        if (!destStat) {
          return fs9.symlink(resolvedSrc, dest, cb);
        } else {
          fs9.readlink(dest, (err2, resolvedDest) => {
            if (err2) {
              if (err2.code === "EINVAL" || err2.code === "UNKNOWN") return fs9.symlink(resolvedSrc, dest, cb);
              return cb(err2);
            }
            if (opts.dereference) {
              resolvedDest = path10.resolve(process.cwd(), resolvedDest);
            }
            if (stat5.isSrcSubdir(resolvedSrc, resolvedDest)) {
              return cb(new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`));
            }
            if (destStat.isDirectory() && stat5.isSrcSubdir(resolvedDest, resolvedSrc)) {
              return cb(new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`));
            }
            return copyLink(resolvedSrc, dest, cb);
          });
        }
      });
    }
    function copyLink(resolvedSrc, dest, cb) {
      fs9.unlink(dest, (err) => {
        if (err) return cb(err);
        return fs9.symlink(resolvedSrc, dest, cb);
      });
    }
    module2.exports = copy;
  }
});

// ../../node_modules/fs-extra/lib/copy/copy-sync.js
var require_copy_sync = __commonJS({
  "../../node_modules/fs-extra/lib/copy/copy-sync.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    var path10 = require("path");
    var mkdirsSync = require_mkdirs().mkdirsSync;
    var utimesMillisSync = require_utimes().utimesMillisSync;
    var stat5 = require_stat();
    function copySync(src, dest, opts) {
      if (typeof opts === "function") {
        opts = { filter: opts };
      }
      opts = opts || {};
      opts.clobber = "clobber" in opts ? !!opts.clobber : true;
      opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
      if (opts.preserveTimestamps && process.arch === "ia32") {
        console.warn(`fs-extra: Using the preserveTimestamps option in 32-bit node is not recommended;

    see https://github.com/jprichardson/node-fs-extra/issues/269`);
      }
      const { srcStat, destStat } = stat5.checkPathsSync(src, dest, "copy", opts);
      stat5.checkParentPathsSync(src, srcStat, dest, "copy");
      return handleFilterAndCopy(destStat, src, dest, opts);
    }
    function handleFilterAndCopy(destStat, src, dest, opts) {
      if (opts.filter && !opts.filter(src, dest)) return;
      const destParent = path10.dirname(dest);
      if (!fs9.existsSync(destParent)) mkdirsSync(destParent);
      return getStats(destStat, src, dest, opts);
    }
    function startCopy(destStat, src, dest, opts) {
      if (opts.filter && !opts.filter(src, dest)) return;
      return getStats(destStat, src, dest, opts);
    }
    function getStats(destStat, src, dest, opts) {
      const statSync2 = opts.dereference ? fs9.statSync : fs9.lstatSync;
      const srcStat = statSync2(src);
      if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts);
      else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts);
      else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts);
      else if (srcStat.isSocket()) throw new Error(`Cannot copy a socket file: ${src}`);
      else if (srcStat.isFIFO()) throw new Error(`Cannot copy a FIFO pipe: ${src}`);
      throw new Error(`Unknown file: ${src}`);
    }
    function onFile(srcStat, destStat, src, dest, opts) {
      if (!destStat) return copyFile(srcStat, src, dest, opts);
      return mayCopyFile(srcStat, src, dest, opts);
    }
    function mayCopyFile(srcStat, src, dest, opts) {
      if (opts.overwrite) {
        fs9.unlinkSync(dest);
        return copyFile(srcStat, src, dest, opts);
      } else if (opts.errorOnExist) {
        throw new Error(`'${dest}' already exists`);
      }
    }
    function copyFile(srcStat, src, dest, opts) {
      fs9.copyFileSync(src, dest);
      if (opts.preserveTimestamps) handleTimestamps(srcStat.mode, src, dest);
      return setDestMode(dest, srcStat.mode);
    }
    function handleTimestamps(srcMode, src, dest) {
      if (fileIsNotWritable(srcMode)) makeFileWritable(dest, srcMode);
      return setDestTimestamps(src, dest);
    }
    function fileIsNotWritable(srcMode) {
      return (srcMode & 128) === 0;
    }
    function makeFileWritable(dest, srcMode) {
      return setDestMode(dest, srcMode | 128);
    }
    function setDestMode(dest, srcMode) {
      return fs9.chmodSync(dest, srcMode);
    }
    function setDestTimestamps(src, dest) {
      const updatedSrcStat = fs9.statSync(src);
      return utimesMillisSync(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
    }
    function onDir(srcStat, destStat, src, dest, opts) {
      if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts);
      return copyDir(src, dest, opts);
    }
    function mkDirAndCopy(srcMode, src, dest, opts) {
      fs9.mkdirSync(dest);
      copyDir(src, dest, opts);
      return setDestMode(dest, srcMode);
    }
    function copyDir(src, dest, opts) {
      fs9.readdirSync(src).forEach((item) => copyDirItem(item, src, dest, opts));
    }
    function copyDirItem(item, src, dest, opts) {
      const srcItem = path10.join(src, item);
      const destItem = path10.join(dest, item);
      const { destStat } = stat5.checkPathsSync(srcItem, destItem, "copy", opts);
      return startCopy(destStat, srcItem, destItem, opts);
    }
    function onLink(destStat, src, dest, opts) {
      let resolvedSrc = fs9.readlinkSync(src);
      if (opts.dereference) {
        resolvedSrc = path10.resolve(process.cwd(), resolvedSrc);
      }
      if (!destStat) {
        return fs9.symlinkSync(resolvedSrc, dest);
      } else {
        let resolvedDest;
        try {
          resolvedDest = fs9.readlinkSync(dest);
        } catch (err) {
          if (err.code === "EINVAL" || err.code === "UNKNOWN") return fs9.symlinkSync(resolvedSrc, dest);
          throw err;
        }
        if (opts.dereference) {
          resolvedDest = path10.resolve(process.cwd(), resolvedDest);
        }
        if (stat5.isSrcSubdir(resolvedSrc, resolvedDest)) {
          throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`);
        }
        if (fs9.statSync(dest).isDirectory() && stat5.isSrcSubdir(resolvedDest, resolvedSrc)) {
          throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`);
        }
        return copyLink(resolvedSrc, dest);
      }
    }
    function copyLink(resolvedSrc, dest) {
      fs9.unlinkSync(dest);
      return fs9.symlinkSync(resolvedSrc, dest);
    }
    module2.exports = copySync;
  }
});

// ../../node_modules/fs-extra/lib/copy/index.js
var require_copy2 = __commonJS({
  "../../node_modules/fs-extra/lib/copy/index.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromCallback;
    module2.exports = {
      copy: u(require_copy()),
      copySync: require_copy_sync()
    };
  }
});

// ../../node_modules/fs-extra/lib/remove/rimraf.js
var require_rimraf = __commonJS({
  "../../node_modules/fs-extra/lib/remove/rimraf.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    var path10 = require("path");
    var assert = require("assert");
    var isWindows = process.platform === "win32";
    function defaults(options) {
      const methods = [
        "unlink",
        "chmod",
        "stat",
        "lstat",
        "rmdir",
        "readdir"
      ];
      methods.forEach((m) => {
        options[m] = options[m] || fs9[m];
        m = m + "Sync";
        options[m] = options[m] || fs9[m];
      });
      options.maxBusyTries = options.maxBusyTries || 3;
    }
    function rimraf(p, options, cb) {
      let busyTries = 0;
      if (typeof options === "function") {
        cb = options;
        options = {};
      }
      assert(p, "rimraf: missing path");
      assert.strictEqual(typeof p, "string", "rimraf: path should be a string");
      assert.strictEqual(typeof cb, "function", "rimraf: callback function required");
      assert(options, "rimraf: invalid options argument provided");
      assert.strictEqual(typeof options, "object", "rimraf: options should be object");
      defaults(options);
      rimraf_(p, options, function CB(er) {
        if (er) {
          if ((er.code === "EBUSY" || er.code === "ENOTEMPTY" || er.code === "EPERM") && busyTries < options.maxBusyTries) {
            busyTries++;
            const time = busyTries * 100;
            return setTimeout(() => rimraf_(p, options, CB), time);
          }
          if (er.code === "ENOENT") er = null;
        }
        cb(er);
      });
    }
    function rimraf_(p, options, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === "function");
      options.lstat(p, (er, st) => {
        if (er && er.code === "ENOENT") {
          return cb(null);
        }
        if (er && er.code === "EPERM" && isWindows) {
          return fixWinEPERM(p, options, er, cb);
        }
        if (st && st.isDirectory()) {
          return rmdir(p, options, er, cb);
        }
        options.unlink(p, (er2) => {
          if (er2) {
            if (er2.code === "ENOENT") {
              return cb(null);
            }
            if (er2.code === "EPERM") {
              return isWindows ? fixWinEPERM(p, options, er2, cb) : rmdir(p, options, er2, cb);
            }
            if (er2.code === "EISDIR") {
              return rmdir(p, options, er2, cb);
            }
          }
          return cb(er2);
        });
      });
    }
    function fixWinEPERM(p, options, er, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === "function");
      options.chmod(p, 438, (er2) => {
        if (er2) {
          cb(er2.code === "ENOENT" ? null : er);
        } else {
          options.stat(p, (er3, stats) => {
            if (er3) {
              cb(er3.code === "ENOENT" ? null : er);
            } else if (stats.isDirectory()) {
              rmdir(p, options, er, cb);
            } else {
              options.unlink(p, cb);
            }
          });
        }
      });
    }
    function fixWinEPERMSync(p, options, er) {
      let stats;
      assert(p);
      assert(options);
      try {
        options.chmodSync(p, 438);
      } catch (er2) {
        if (er2.code === "ENOENT") {
          return;
        } else {
          throw er;
        }
      }
      try {
        stats = options.statSync(p);
      } catch (er3) {
        if (er3.code === "ENOENT") {
          return;
        } else {
          throw er;
        }
      }
      if (stats.isDirectory()) {
        rmdirSync(p, options, er);
      } else {
        options.unlinkSync(p);
      }
    }
    function rmdir(p, options, originalEr, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === "function");
      options.rmdir(p, (er) => {
        if (er && (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM")) {
          rmkids(p, options, cb);
        } else if (er && er.code === "ENOTDIR") {
          cb(originalEr);
        } else {
          cb(er);
        }
      });
    }
    function rmkids(p, options, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === "function");
      options.readdir(p, (er, files) => {
        if (er) return cb(er);
        let n = files.length;
        let errState;
        if (n === 0) return options.rmdir(p, cb);
        files.forEach((f) => {
          rimraf(path10.join(p, f), options, (er2) => {
            if (errState) {
              return;
            }
            if (er2) return cb(errState = er2);
            if (--n === 0) {
              options.rmdir(p, cb);
            }
          });
        });
      });
    }
    function rimrafSync(p, options) {
      let st;
      options = options || {};
      defaults(options);
      assert(p, "rimraf: missing path");
      assert.strictEqual(typeof p, "string", "rimraf: path should be a string");
      assert(options, "rimraf: missing options");
      assert.strictEqual(typeof options, "object", "rimraf: options should be object");
      try {
        st = options.lstatSync(p);
      } catch (er) {
        if (er.code === "ENOENT") {
          return;
        }
        if (er.code === "EPERM" && isWindows) {
          fixWinEPERMSync(p, options, er);
        }
      }
      try {
        if (st && st.isDirectory()) {
          rmdirSync(p, options, null);
        } else {
          options.unlinkSync(p);
        }
      } catch (er) {
        if (er.code === "ENOENT") {
          return;
        } else if (er.code === "EPERM") {
          return isWindows ? fixWinEPERMSync(p, options, er) : rmdirSync(p, options, er);
        } else if (er.code !== "EISDIR") {
          throw er;
        }
        rmdirSync(p, options, er);
      }
    }
    function rmdirSync(p, options, originalEr) {
      assert(p);
      assert(options);
      try {
        options.rmdirSync(p);
      } catch (er) {
        if (er.code === "ENOTDIR") {
          throw originalEr;
        } else if (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM") {
          rmkidsSync(p, options);
        } else if (er.code !== "ENOENT") {
          throw er;
        }
      }
    }
    function rmkidsSync(p, options) {
      assert(p);
      assert(options);
      options.readdirSync(p).forEach((f) => rimrafSync(path10.join(p, f), options));
      if (isWindows) {
        const startTime = Date.now();
        do {
          try {
            const ret = options.rmdirSync(p, options);
            return ret;
          } catch {
          }
        } while (Date.now() - startTime < 500);
      } else {
        const ret = options.rmdirSync(p, options);
        return ret;
      }
    }
    module2.exports = rimraf;
    rimraf.sync = rimrafSync;
  }
});

// ../../node_modules/fs-extra/lib/remove/index.js
var require_remove = __commonJS({
  "../../node_modules/fs-extra/lib/remove/index.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    var u = require_universalify().fromCallback;
    var rimraf = require_rimraf();
    function remove(path10, callback) {
      if (fs9.rm) return fs9.rm(path10, { recursive: true, force: true }, callback);
      rimraf(path10, callback);
    }
    function removeSync(path10) {
      if (fs9.rmSync) return fs9.rmSync(path10, { recursive: true, force: true });
      rimraf.sync(path10);
    }
    module2.exports = {
      remove: u(remove),
      removeSync
    };
  }
});

// ../../node_modules/fs-extra/lib/empty/index.js
var require_empty = __commonJS({
  "../../node_modules/fs-extra/lib/empty/index.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromPromise;
    var fs9 = require_fs();
    var path10 = require("path");
    var mkdir = require_mkdirs();
    var remove = require_remove();
    var emptyDir = u(async function emptyDir2(dir) {
      let items;
      try {
        items = await fs9.readdir(dir);
      } catch {
        return mkdir.mkdirs(dir);
      }
      return Promise.all(items.map((item) => remove.remove(path10.join(dir, item))));
    });
    function emptyDirSync(dir) {
      let items;
      try {
        items = fs9.readdirSync(dir);
      } catch {
        return mkdir.mkdirsSync(dir);
      }
      items.forEach((item) => {
        item = path10.join(dir, item);
        remove.removeSync(item);
      });
    }
    module2.exports = {
      emptyDirSync,
      emptydirSync: emptyDirSync,
      emptyDir,
      emptydir: emptyDir
    };
  }
});

// ../../node_modules/fs-extra/lib/ensure/file.js
var require_file = __commonJS({
  "../../node_modules/fs-extra/lib/ensure/file.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromCallback;
    var path10 = require("path");
    var fs9 = require_graceful_fs();
    var mkdir = require_mkdirs();
    function createFile(file, callback) {
      function makeFile() {
        fs9.writeFile(file, "", (err) => {
          if (err) return callback(err);
          callback();
        });
      }
      fs9.stat(file, (err, stats) => {
        if (!err && stats.isFile()) return callback();
        const dir = path10.dirname(file);
        fs9.stat(dir, (err2, stats2) => {
          if (err2) {
            if (err2.code === "ENOENT") {
              return mkdir.mkdirs(dir, (err3) => {
                if (err3) return callback(err3);
                makeFile();
              });
            }
            return callback(err2);
          }
          if (stats2.isDirectory()) makeFile();
          else {
            fs9.readdir(dir, (err3) => {
              if (err3) return callback(err3);
            });
          }
        });
      });
    }
    function createFileSync(file) {
      let stats;
      try {
        stats = fs9.statSync(file);
      } catch {
      }
      if (stats && stats.isFile()) return;
      const dir = path10.dirname(file);
      try {
        if (!fs9.statSync(dir).isDirectory()) {
          fs9.readdirSync(dir);
        }
      } catch (err) {
        if (err && err.code === "ENOENT") mkdir.mkdirsSync(dir);
        else throw err;
      }
      fs9.writeFileSync(file, "");
    }
    module2.exports = {
      createFile: u(createFile),
      createFileSync
    };
  }
});

// ../../node_modules/fs-extra/lib/ensure/link.js
var require_link = __commonJS({
  "../../node_modules/fs-extra/lib/ensure/link.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromCallback;
    var path10 = require("path");
    var fs9 = require_graceful_fs();
    var mkdir = require_mkdirs();
    var pathExists8 = require_path_exists().pathExists;
    var { areIdentical } = require_stat();
    function createLink(srcpath, dstpath, callback) {
      function makeLink(srcpath2, dstpath2) {
        fs9.link(srcpath2, dstpath2, (err) => {
          if (err) return callback(err);
          callback(null);
        });
      }
      fs9.lstat(dstpath, (_, dstStat) => {
        fs9.lstat(srcpath, (err, srcStat) => {
          if (err) {
            err.message = err.message.replace("lstat", "ensureLink");
            return callback(err);
          }
          if (dstStat && areIdentical(srcStat, dstStat)) return callback(null);
          const dir = path10.dirname(dstpath);
          pathExists8(dir, (err2, dirExists) => {
            if (err2) return callback(err2);
            if (dirExists) return makeLink(srcpath, dstpath);
            mkdir.mkdirs(dir, (err3) => {
              if (err3) return callback(err3);
              makeLink(srcpath, dstpath);
            });
          });
        });
      });
    }
    function createLinkSync(srcpath, dstpath) {
      let dstStat;
      try {
        dstStat = fs9.lstatSync(dstpath);
      } catch {
      }
      try {
        const srcStat = fs9.lstatSync(srcpath);
        if (dstStat && areIdentical(srcStat, dstStat)) return;
      } catch (err) {
        err.message = err.message.replace("lstat", "ensureLink");
        throw err;
      }
      const dir = path10.dirname(dstpath);
      const dirExists = fs9.existsSync(dir);
      if (dirExists) return fs9.linkSync(srcpath, dstpath);
      mkdir.mkdirsSync(dir);
      return fs9.linkSync(srcpath, dstpath);
    }
    module2.exports = {
      createLink: u(createLink),
      createLinkSync
    };
  }
});

// ../../node_modules/fs-extra/lib/ensure/symlink-paths.js
var require_symlink_paths = __commonJS({
  "../../node_modules/fs-extra/lib/ensure/symlink-paths.js"(exports2, module2) {
    "use strict";
    var path10 = require("path");
    var fs9 = require_graceful_fs();
    var pathExists8 = require_path_exists().pathExists;
    function symlinkPaths(srcpath, dstpath, callback) {
      if (path10.isAbsolute(srcpath)) {
        return fs9.lstat(srcpath, (err) => {
          if (err) {
            err.message = err.message.replace("lstat", "ensureSymlink");
            return callback(err);
          }
          return callback(null, {
            toCwd: srcpath,
            toDst: srcpath
          });
        });
      } else {
        const dstdir = path10.dirname(dstpath);
        const relativeToDst = path10.join(dstdir, srcpath);
        return pathExists8(relativeToDst, (err, exists) => {
          if (err) return callback(err);
          if (exists) {
            return callback(null, {
              toCwd: relativeToDst,
              toDst: srcpath
            });
          } else {
            return fs9.lstat(srcpath, (err2) => {
              if (err2) {
                err2.message = err2.message.replace("lstat", "ensureSymlink");
                return callback(err2);
              }
              return callback(null, {
                toCwd: srcpath,
                toDst: path10.relative(dstdir, srcpath)
              });
            });
          }
        });
      }
    }
    function symlinkPathsSync(srcpath, dstpath) {
      let exists;
      if (path10.isAbsolute(srcpath)) {
        exists = fs9.existsSync(srcpath);
        if (!exists) throw new Error("absolute srcpath does not exist");
        return {
          toCwd: srcpath,
          toDst: srcpath
        };
      } else {
        const dstdir = path10.dirname(dstpath);
        const relativeToDst = path10.join(dstdir, srcpath);
        exists = fs9.existsSync(relativeToDst);
        if (exists) {
          return {
            toCwd: relativeToDst,
            toDst: srcpath
          };
        } else {
          exists = fs9.existsSync(srcpath);
          if (!exists) throw new Error("relative srcpath does not exist");
          return {
            toCwd: srcpath,
            toDst: path10.relative(dstdir, srcpath)
          };
        }
      }
    }
    module2.exports = {
      symlinkPaths,
      symlinkPathsSync
    };
  }
});

// ../../node_modules/fs-extra/lib/ensure/symlink-type.js
var require_symlink_type = __commonJS({
  "../../node_modules/fs-extra/lib/ensure/symlink-type.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    function symlinkType(srcpath, type, callback) {
      callback = typeof type === "function" ? type : callback;
      type = typeof type === "function" ? false : type;
      if (type) return callback(null, type);
      fs9.lstat(srcpath, (err, stats) => {
        if (err) return callback(null, "file");
        type = stats && stats.isDirectory() ? "dir" : "file";
        callback(null, type);
      });
    }
    function symlinkTypeSync(srcpath, type) {
      let stats;
      if (type) return type;
      try {
        stats = fs9.lstatSync(srcpath);
      } catch {
        return "file";
      }
      return stats && stats.isDirectory() ? "dir" : "file";
    }
    module2.exports = {
      symlinkType,
      symlinkTypeSync
    };
  }
});

// ../../node_modules/fs-extra/lib/ensure/symlink.js
var require_symlink = __commonJS({
  "../../node_modules/fs-extra/lib/ensure/symlink.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromCallback;
    var path10 = require("path");
    var fs9 = require_fs();
    var _mkdirs = require_mkdirs();
    var mkdirs = _mkdirs.mkdirs;
    var mkdirsSync = _mkdirs.mkdirsSync;
    var _symlinkPaths = require_symlink_paths();
    var symlinkPaths = _symlinkPaths.symlinkPaths;
    var symlinkPathsSync = _symlinkPaths.symlinkPathsSync;
    var _symlinkType = require_symlink_type();
    var symlinkType = _symlinkType.symlinkType;
    var symlinkTypeSync = _symlinkType.symlinkTypeSync;
    var pathExists8 = require_path_exists().pathExists;
    var { areIdentical } = require_stat();
    function createSymlink(srcpath, dstpath, type, callback) {
      callback = typeof type === "function" ? type : callback;
      type = typeof type === "function" ? false : type;
      fs9.lstat(dstpath, (err, stats) => {
        if (!err && stats.isSymbolicLink()) {
          Promise.all([
            fs9.stat(srcpath),
            fs9.stat(dstpath)
          ]).then(([srcStat, dstStat]) => {
            if (areIdentical(srcStat, dstStat)) return callback(null);
            _createSymlink(srcpath, dstpath, type, callback);
          });
        } else _createSymlink(srcpath, dstpath, type, callback);
      });
    }
    function _createSymlink(srcpath, dstpath, type, callback) {
      symlinkPaths(srcpath, dstpath, (err, relative2) => {
        if (err) return callback(err);
        srcpath = relative2.toDst;
        symlinkType(relative2.toCwd, type, (err2, type2) => {
          if (err2) return callback(err2);
          const dir = path10.dirname(dstpath);
          pathExists8(dir, (err3, dirExists) => {
            if (err3) return callback(err3);
            if (dirExists) return fs9.symlink(srcpath, dstpath, type2, callback);
            mkdirs(dir, (err4) => {
              if (err4) return callback(err4);
              fs9.symlink(srcpath, dstpath, type2, callback);
            });
          });
        });
      });
    }
    function createSymlinkSync(srcpath, dstpath, type) {
      let stats;
      try {
        stats = fs9.lstatSync(dstpath);
      } catch {
      }
      if (stats && stats.isSymbolicLink()) {
        const srcStat = fs9.statSync(srcpath);
        const dstStat = fs9.statSync(dstpath);
        if (areIdentical(srcStat, dstStat)) return;
      }
      const relative2 = symlinkPathsSync(srcpath, dstpath);
      srcpath = relative2.toDst;
      type = symlinkTypeSync(relative2.toCwd, type);
      const dir = path10.dirname(dstpath);
      const exists = fs9.existsSync(dir);
      if (exists) return fs9.symlinkSync(srcpath, dstpath, type);
      mkdirsSync(dir);
      return fs9.symlinkSync(srcpath, dstpath, type);
    }
    module2.exports = {
      createSymlink: u(createSymlink),
      createSymlinkSync
    };
  }
});

// ../../node_modules/fs-extra/lib/ensure/index.js
var require_ensure = __commonJS({
  "../../node_modules/fs-extra/lib/ensure/index.js"(exports2, module2) {
    "use strict";
    var { createFile, createFileSync } = require_file();
    var { createLink, createLinkSync } = require_link();
    var { createSymlink, createSymlinkSync } = require_symlink();
    module2.exports = {
      // file
      createFile,
      createFileSync,
      ensureFile: createFile,
      ensureFileSync: createFileSync,
      // link
      createLink,
      createLinkSync,
      ensureLink: createLink,
      ensureLinkSync: createLinkSync,
      // symlink
      createSymlink,
      createSymlinkSync,
      ensureSymlink: createSymlink,
      ensureSymlinkSync: createSymlinkSync
    };
  }
});

// ../../node_modules/fs-extra/node_modules/jsonfile/utils.js
var require_utils2 = __commonJS({
  "../../node_modules/fs-extra/node_modules/jsonfile/utils.js"(exports2, module2) {
    function stringify(obj, { EOL = "\n", finalEOL = true, replacer = null, spaces } = {}) {
      const EOF = finalEOL ? EOL : "";
      const str = JSON.stringify(obj, replacer, spaces);
      return str.replace(/\n/g, EOL) + EOF;
    }
    function stripBom(content) {
      if (Buffer.isBuffer(content)) content = content.toString("utf8");
      return content.replace(/^\uFEFF/, "");
    }
    module2.exports = { stringify, stripBom };
  }
});

// ../../node_modules/fs-extra/node_modules/jsonfile/index.js
var require_jsonfile = __commonJS({
  "../../node_modules/fs-extra/node_modules/jsonfile/index.js"(exports2, module2) {
    var _fs;
    try {
      _fs = require_graceful_fs();
    } catch (_) {
      _fs = require("fs");
    }
    var universalify = require_universalify();
    var { stringify, stripBom } = require_utils2();
    async function _readFile(file, options = {}) {
      if (typeof options === "string") {
        options = { encoding: options };
      }
      const fs9 = options.fs || _fs;
      const shouldThrow = "throws" in options ? options.throws : true;
      let data = await universalify.fromCallback(fs9.readFile)(file, options);
      data = stripBom(data);
      let obj;
      try {
        obj = JSON.parse(data, options ? options.reviver : null);
      } catch (err) {
        if (shouldThrow) {
          err.message = `${file}: ${err.message}`;
          throw err;
        } else {
          return null;
        }
      }
      return obj;
    }
    var readFile4 = universalify.fromPromise(_readFile);
    function readFileSync(file, options = {}) {
      if (typeof options === "string") {
        options = { encoding: options };
      }
      const fs9 = options.fs || _fs;
      const shouldThrow = "throws" in options ? options.throws : true;
      try {
        let content = fs9.readFileSync(file, options);
        content = stripBom(content);
        return JSON.parse(content, options.reviver);
      } catch (err) {
        if (shouldThrow) {
          err.message = `${file}: ${err.message}`;
          throw err;
        } else {
          return null;
        }
      }
    }
    async function _writeFile(file, obj, options = {}) {
      const fs9 = options.fs || _fs;
      const str = stringify(obj, options);
      await universalify.fromCallback(fs9.writeFile)(file, str, options);
    }
    var writeFile = universalify.fromPromise(_writeFile);
    function writeFileSync(file, obj, options = {}) {
      const fs9 = options.fs || _fs;
      const str = stringify(obj, options);
      return fs9.writeFileSync(file, str, options);
    }
    var jsonfile = {
      readFile: readFile4,
      readFileSync,
      writeFile,
      writeFileSync
    };
    module2.exports = jsonfile;
  }
});

// ../../node_modules/fs-extra/lib/json/jsonfile.js
var require_jsonfile2 = __commonJS({
  "../../node_modules/fs-extra/lib/json/jsonfile.js"(exports2, module2) {
    "use strict";
    var jsonFile = require_jsonfile();
    module2.exports = {
      // jsonfile exports
      readJson: jsonFile.readFile,
      readJsonSync: jsonFile.readFileSync,
      writeJson: jsonFile.writeFile,
      writeJsonSync: jsonFile.writeFileSync
    };
  }
});

// ../../node_modules/fs-extra/lib/output-file/index.js
var require_output_file = __commonJS({
  "../../node_modules/fs-extra/lib/output-file/index.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromCallback;
    var fs9 = require_graceful_fs();
    var path10 = require("path");
    var mkdir = require_mkdirs();
    var pathExists8 = require_path_exists().pathExists;
    function outputFile(file, data, encoding, callback) {
      if (typeof encoding === "function") {
        callback = encoding;
        encoding = "utf8";
      }
      const dir = path10.dirname(file);
      pathExists8(dir, (err, itDoes) => {
        if (err) return callback(err);
        if (itDoes) return fs9.writeFile(file, data, encoding, callback);
        mkdir.mkdirs(dir, (err2) => {
          if (err2) return callback(err2);
          fs9.writeFile(file, data, encoding, callback);
        });
      });
    }
    function outputFileSync(file, ...args) {
      const dir = path10.dirname(file);
      if (fs9.existsSync(dir)) {
        return fs9.writeFileSync(file, ...args);
      }
      mkdir.mkdirsSync(dir);
      fs9.writeFileSync(file, ...args);
    }
    module2.exports = {
      outputFile: u(outputFile),
      outputFileSync
    };
  }
});

// ../../node_modules/fs-extra/lib/json/output-json.js
var require_output_json = __commonJS({
  "../../node_modules/fs-extra/lib/json/output-json.js"(exports2, module2) {
    "use strict";
    var { stringify } = require_utils2();
    var { outputFile } = require_output_file();
    async function outputJson(file, data, options = {}) {
      const str = stringify(data, options);
      await outputFile(file, str, options);
    }
    module2.exports = outputJson;
  }
});

// ../../node_modules/fs-extra/lib/json/output-json-sync.js
var require_output_json_sync = __commonJS({
  "../../node_modules/fs-extra/lib/json/output-json-sync.js"(exports2, module2) {
    "use strict";
    var { stringify } = require_utils2();
    var { outputFileSync } = require_output_file();
    function outputJsonSync(file, data, options) {
      const str = stringify(data, options);
      outputFileSync(file, str, options);
    }
    module2.exports = outputJsonSync;
  }
});

// ../../node_modules/fs-extra/lib/json/index.js
var require_json = __commonJS({
  "../../node_modules/fs-extra/lib/json/index.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromPromise;
    var jsonFile = require_jsonfile2();
    jsonFile.outputJson = u(require_output_json());
    jsonFile.outputJsonSync = require_output_json_sync();
    jsonFile.outputJSON = jsonFile.outputJson;
    jsonFile.outputJSONSync = jsonFile.outputJsonSync;
    jsonFile.writeJSON = jsonFile.writeJson;
    jsonFile.writeJSONSync = jsonFile.writeJsonSync;
    jsonFile.readJSON = jsonFile.readJson;
    jsonFile.readJSONSync = jsonFile.readJsonSync;
    module2.exports = jsonFile;
  }
});

// ../../node_modules/fs-extra/lib/move/move.js
var require_move = __commonJS({
  "../../node_modules/fs-extra/lib/move/move.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    var path10 = require("path");
    var copy = require_copy2().copy;
    var remove = require_remove().remove;
    var mkdirp = require_mkdirs().mkdirp;
    var pathExists8 = require_path_exists().pathExists;
    var stat5 = require_stat();
    function move(src, dest, opts, cb) {
      if (typeof opts === "function") {
        cb = opts;
        opts = {};
      }
      const overwrite = opts.overwrite || opts.clobber || false;
      stat5.checkPaths(src, dest, "move", opts, (err, stats) => {
        if (err) return cb(err);
        const { srcStat, isChangingCase = false } = stats;
        stat5.checkParentPaths(src, srcStat, dest, "move", (err2) => {
          if (err2) return cb(err2);
          if (isParentRoot(dest)) return doRename(src, dest, overwrite, isChangingCase, cb);
          mkdirp(path10.dirname(dest), (err3) => {
            if (err3) return cb(err3);
            return doRename(src, dest, overwrite, isChangingCase, cb);
          });
        });
      });
    }
    function isParentRoot(dest) {
      const parent = path10.dirname(dest);
      const parsedPath = path10.parse(parent);
      return parsedPath.root === parent;
    }
    function doRename(src, dest, overwrite, isChangingCase, cb) {
      if (isChangingCase) return rename(src, dest, overwrite, cb);
      if (overwrite) {
        return remove(dest, (err) => {
          if (err) return cb(err);
          return rename(src, dest, overwrite, cb);
        });
      }
      pathExists8(dest, (err, destExists) => {
        if (err) return cb(err);
        if (destExists) return cb(new Error("dest already exists."));
        return rename(src, dest, overwrite, cb);
      });
    }
    function rename(src, dest, overwrite, cb) {
      fs9.rename(src, dest, (err) => {
        if (!err) return cb();
        if (err.code !== "EXDEV") return cb(err);
        return moveAcrossDevice(src, dest, overwrite, cb);
      });
    }
    function moveAcrossDevice(src, dest, overwrite, cb) {
      const opts = {
        overwrite,
        errorOnExist: true
      };
      copy(src, dest, opts, (err) => {
        if (err) return cb(err);
        return remove(src, cb);
      });
    }
    module2.exports = move;
  }
});

// ../../node_modules/fs-extra/lib/move/move-sync.js
var require_move_sync = __commonJS({
  "../../node_modules/fs-extra/lib/move/move-sync.js"(exports2, module2) {
    "use strict";
    var fs9 = require_graceful_fs();
    var path10 = require("path");
    var copySync = require_copy2().copySync;
    var removeSync = require_remove().removeSync;
    var mkdirpSync = require_mkdirs().mkdirpSync;
    var stat5 = require_stat();
    function moveSync(src, dest, opts) {
      opts = opts || {};
      const overwrite = opts.overwrite || opts.clobber || false;
      const { srcStat, isChangingCase = false } = stat5.checkPathsSync(src, dest, "move", opts);
      stat5.checkParentPathsSync(src, srcStat, dest, "move");
      if (!isParentRoot(dest)) mkdirpSync(path10.dirname(dest));
      return doRename(src, dest, overwrite, isChangingCase);
    }
    function isParentRoot(dest) {
      const parent = path10.dirname(dest);
      const parsedPath = path10.parse(parent);
      return parsedPath.root === parent;
    }
    function doRename(src, dest, overwrite, isChangingCase) {
      if (isChangingCase) return rename(src, dest, overwrite);
      if (overwrite) {
        removeSync(dest);
        return rename(src, dest, overwrite);
      }
      if (fs9.existsSync(dest)) throw new Error("dest already exists.");
      return rename(src, dest, overwrite);
    }
    function rename(src, dest, overwrite) {
      try {
        fs9.renameSync(src, dest);
      } catch (err) {
        if (err.code !== "EXDEV") throw err;
        return moveAcrossDevice(src, dest, overwrite);
      }
    }
    function moveAcrossDevice(src, dest, overwrite) {
      const opts = {
        overwrite,
        errorOnExist: true
      };
      copySync(src, dest, opts);
      return removeSync(src);
    }
    module2.exports = moveSync;
  }
});

// ../../node_modules/fs-extra/lib/move/index.js
var require_move2 = __commonJS({
  "../../node_modules/fs-extra/lib/move/index.js"(exports2, module2) {
    "use strict";
    var u = require_universalify().fromCallback;
    module2.exports = {
      move: u(require_move()),
      moveSync: require_move_sync()
    };
  }
});

// ../../node_modules/fs-extra/lib/index.js
var require_lib = __commonJS({
  "../../node_modules/fs-extra/lib/index.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      // Export promiseified graceful-fs:
      ...require_fs(),
      // Export extra methods:
      ...require_copy2(),
      ...require_empty(),
      ...require_ensure(),
      ...require_json(),
      ...require_mkdirs(),
      ...require_move2(),
      ...require_output_file(),
      ...require_path_exists(),
      ...require_remove()
    };
  }
});

// src/pyenv.ts
var fs2 = __toESM(require_lib());
var path2 = __toESM(require("path"));
var import_os = require("os");

// src/utils.ts
var fs = __toESM(require_lib());
var path = __toESM(require("path"));
var PyEnvCfg = class {
  version;
  constructor(version) {
    this.version = version;
  }
};
var PYVENV_CONFIG_FILE = "pyvenv.cfg";
async function findPyvenvConfigPath(pythonExecutable) {
  const cfg = path.join(path.dirname(pythonExecutable), PYVENV_CONFIG_FILE);
  if (await fs.pathExists(cfg)) {
    return cfg;
  }
  const cfg2 = path.join(path.dirname(path.dirname(pythonExecutable)), PYVENV_CONFIG_FILE);
  if (await fs.pathExists(cfg2)) {
    return cfg2;
  }
  return void 0;
}
async function findAndParsePyvenvCfg(pythonExecutable) {
  const cfgPath = await findPyvenvConfigPath(pythonExecutable);
  if (!cfgPath || !await fs.pathExists(cfgPath)) {
    return void 0;
  }
  const contents = await fs.readFile(cfgPath, "utf8");
  const versionRegex = /^version\s*=\s*(\d+\.\d+\.\d+)$/m;
  const versionInfoRegex = /^version_info\s*=\s*(\d+\.\d+\.\d+.*)$/m;
  for (const line of contents.split("\n")) {
    if (!line.includes("version")) {
      continue;
    }
    const versionMatch = line.match(versionRegex);
    if (versionMatch && versionMatch[1]) {
      return new PyEnvCfg(versionMatch[1]);
    }
    const versionInfoMatch = line.match(versionInfoRegex);
    if (versionInfoMatch && versionInfoMatch[1]) {
      return new PyEnvCfg(versionInfoMatch[1]);
    }
  }
  return void 0;
}
async function getVersion(pythonExecutable) {
  const parentFolder = path.dirname(pythonExecutable);
  const pyenvCfg = await findAndParsePyvenvCfg(parentFolder);
  if (pyenvCfg) {
    return pyenvCfg.version;
  }
}
async function findPythonBinaryPath(envPath) {
  const pythonBinName = process.platform === "win32" ? "python.exe" : "python";
  const paths = [
    path.join(envPath, "bin", pythonBinName),
    path.join(envPath, "Scripts", pythonBinName),
    path.join(envPath, pythonBinName)
  ];
  for (const p of paths) {
    if (await fs.pathExists(p)) {
      return p;
    }
  }
  return void 0;
}
async function listPythonEnvironments(envPath) {
  const pythonEnvs = [];
  try {
    const venvDirs = await fs.readdir(envPath);
    await Promise.all(
      venvDirs.map(async (venvDir) => {
        const venvDirPath = path.join(envPath, venvDir);
        const stat5 = await fs.stat(venvDirPath);
        if (!stat5.isDirectory()) {
          return;
        }
        const executable = await findPythonBinaryPath(venvDirPath);
        if (executable) {
          pythonEnvs.push({
            executable,
            path: venvDirPath,
            version: await getVersion(executable)
          });
        }
      })
    );
    return pythonEnvs;
  } catch (error) {
    return void 0;
  }
}

// src/known.ts
function getKnowGlobalSearchLocations() {
  return [
    "/usr/bin",
    "/usr/local/bin",
    "/bin",
    "/home/bin",
    "/sbin",
    "/usr/sbin",
    "/usr/local/sbin",
    "/home/sbin",
    "/opt",
    "/opt/bin",
    "/opt/sbin",
    "/opt/homebrew/bin"
  ];
}

// src/pyenv.ts
function getHomePyenvDir() {
  const home = (0, import_os.homedir)();
  if (home) {
    return path2.join(home, ".pyenv");
  }
}
async function getBinaryFromKnownPaths() {
  const knownPaths = getKnowGlobalSearchLocations();
  for (const knownPath of knownPaths) {
    const bin = path2.join(knownPath, "pyenv");
    if (await fs2.pathExists(bin)) {
      return bin;
    }
  }
}
function getPyenvDir() {
  const pyenvRoot = process.env.PYENV_ROOT;
  if (pyenvRoot) {
    return pyenvRoot;
  }
  const pyenv = process.env.PYENV;
  if (pyenv) {
    return pyenv;
  }
  return getHomePyenvDir();
}
async function getPyenvBinary() {
  const dir = getPyenvDir();
  if (dir) {
    const exe = path2.join(dir, "bin", "pyenv");
    if (fs2.existsSync(exe)) {
      return exe;
    }
  }
  return getBinaryFromKnownPaths();
}
function getPyenvVersion(folderName) {
  const pythonRegex = /^(\d+\.\d+\.\d+)$/;
  const match = pythonRegex.exec(folderName);
  if (match) {
    return match[1];
  }
  const devRegex = /^(\d+\.\d+-dev)$/;
  const devMatch = devRegex.exec(folderName);
  if (devMatch) {
    return devMatch[1];
  }
  const alphaRegex = /^(\d+\.\d+.\d+\w\d+)/;
  const alphaMatch = alphaRegex.exec(folderName);
  if (alphaMatch) {
    return alphaMatch[1];
  }
}
function getPurePythonEnvironment(executable, folderPath, manager) {
  const version = getPyenvVersion(path2.basename(folderPath));
  if (version) {
    return {
      python_executable_path: executable,
      category: 3 /* Pyenv */,
      version,
      env_path: folderPath,
      sys_prefix_path: folderPath,
      env_manager: manager,
      python_run_command: [executable]
    };
  }
}
async function getVirtualEnvEnvironment(executable, folderPath, manager) {
  const pyenvCfg = await findAndParsePyvenvCfg(executable);
  if (pyenvCfg) {
    const folderName = path2.basename(folderPath);
    return {
      name: folderName,
      python_executable_path: executable,
      category: 4 /* PyenvVirtualEnv */,
      version: pyenvCfg.version,
      env_path: folderPath,
      sys_prefix_path: folderPath,
      env_manager: manager,
      python_run_command: [executable]
    };
  }
}
async function listPyenvEnvironments(manager) {
  const pyenvDir = getPyenvDir();
  if (!pyenvDir) {
    return;
  }
  const envs = [];
  const versionsDir = path2.join(pyenvDir, "versions");
  try {
    const entries = await fs2.readdir(versionsDir);
    await Promise.all(
      entries.map(async (entry) => {
        const folderPath = path2.join(versionsDir, entry);
        const stats = await fs2.stat(folderPath);
        if (stats.isDirectory()) {
          const executable = await findPythonBinaryPath(folderPath);
          if (executable) {
            const purePythonEnv = getPurePythonEnvironment(executable, folderPath, manager);
            if (purePythonEnv) {
              envs.push(purePythonEnv);
            } else {
              const virtualEnv = await getVirtualEnvEnvironment(executable, folderPath, manager);
              if (virtualEnv) {
                envs.push(virtualEnv);
              }
            }
          }
        }
      })
    );
  } catch (error) {
    console.error(`Failed to read directory: ${versionsDir}`);
  }
  return envs;
}
async function find() {
  const pyenvBinary = await getPyenvBinary();
  if (!pyenvBinary) {
    return void 0;
  }
  const manager = { executable_path: pyenvBinary, tool: 1 /* Pyenv */ };
  const environments = [];
  const envs = await listPyenvEnvironments(manager);
  if (envs) {
    environments.push(...envs);
  }
  if (environments.length === 0) {
    return { managers: [manager] };
  }
  return { environments };
}

// src/homebrew.ts
var fs3 = __toESM(require_lib());
var path3 = __toESM(require("path"));
async function isSymlinkedPythonExecutable(file) {
  const name = path3.basename(file);
  if (!name.startsWith("python") || name.endsWith("-config") || name.endsWith("-build")) {
    return void 0;
  }
  const metadata = await fs3.lstat(file);
  if (metadata.isFile() || !metadata.isSymbolicLink()) {
    return void 0;
  }
  return await fs3.realpath(file);
}
async function find2() {
  const homebrewPrefix = process.env.HOMEBREW_PREFIX;
  if (!homebrewPrefix) {
    return void 0;
  }
  const homebrewPrefixBin = path3.join(homebrewPrefix, "bin");
  const reported = /* @__PURE__ */ new Set();
  const pythonRegex = new RegExp(/\/(\d+\.\d+\.\d+)\//);
  const environments = [];
  const dirs = await fs3.readdir(homebrewPrefixBin);
  await Promise.all(
    dirs.map(async (file) => {
      const exe = await isSymlinkedPythonExecutable(path3.join(homebrewPrefixBin, file));
      if (exe) {
        const pythonVersion = exe;
        const version = pythonRegex.exec(pythonVersion)?.[1];
        if (reported.has(exe)) {
          return;
        }
        reported.add(exe);
        const env = {
          python_executable_path: exe,
          category: 1 /* Homebrew */,
          version,
          python_run_command: [exe]
        };
        environments.push(env);
      }
    })
  );
  if (environments.length === 0) {
    return void 0;
  }
  return { environments };
}

// src/conda.ts
var path4 = __toESM(require("path"));
var fs4 = __toESM(require_lib());
var import_os2 = require("os");
function getCondaMetaPath(anyPath) {
  if (anyPath.endsWith("bin/python")) {
    const parent = path4.dirname(anyPath);
    const grandParent = path4.dirname(parent);
    return path4.join(grandParent, "conda-meta");
  } else if (anyPath.endsWith("bin")) {
    const parent = path4.dirname(anyPath);
    return path4.join(parent, "conda-meta");
  } else {
    return path4.join(anyPath, "conda-meta");
  }
}
async function isCondaEnvironment(anyPath) {
  const condaMetaPath = getCondaMetaPath(anyPath);
  return condaMetaPath !== void 0 && await fs4.pathExists(condaMetaPath);
}
function getVersionFromMetaJson(jsonFile) {
  const fileName = path4.basename(jsonFile);
  const regex = /([\d\w\-]*)-([\d\.]*)-.*\.json/;
  const match = fileName.match(regex);
  return match ? match[2] : void 0;
}
async function getCondaPackageJsonPath(anyPath, packageName) {
  const packagePrefix = `${packageName}-`;
  const condaMetaPath = getCondaMetaPath(anyPath);
  const entries = await fs4.readdir(condaMetaPath);
  for (const entry of entries) {
    const filePath = path4.join(condaMetaPath, entry);
    const fileName = path4.basename(filePath);
    if (fileName.startsWith(packagePrefix) && fileName.endsWith(".json")) {
      return filePath;
    }
  }
  return void 0;
}
async function getCondaPythonVersion(anyPath) {
  const condaPythonJsonPath = await getCondaPackageJsonPath(anyPath, "python");
  return condaPythonJsonPath ? getVersionFromMetaJson(condaPythonJsonPath) : void 0;
}
function getCondaBinNames() {
  return process.platform === "win32" ? ["conda.exe", "conda.bat"] : ["conda"];
}
async function findCondaBinaryOnPath() {
  const paths = process.env.PATH?.split(path4.delimiter) || [];
  const condaBinNames = getCondaBinNames();
  for (const pathEntry of paths) {
    for (const binName of condaBinNames) {
      const condaPath = path4.join(pathEntry, binName);
      try {
        const stats = await fs4.stat(condaPath);
        if (stats.isFile() || stats.isSymbolicLink()) {
          return condaPath;
        }
      } catch (error) {
      }
    }
  }
  return void 0;
}
function getKnownCondaLocations() {
  const knownPaths = [
    "/opt/anaconda3/bin",
    "/opt/miniconda3/bin",
    "/usr/local/anaconda3/bin",
    "/usr/local/miniconda3/bin",
    "/usr/anaconda3/bin",
    "/usr/miniconda3/bin",
    "/home/anaconda3/bin",
    "/home/miniconda3/bin",
    "/anaconda3/bin",
    "/miniconda3/bin"
  ];
  const home = (0, import_os2.homedir)();
  if (home) {
    knownPaths.push(path4.join(home, "anaconda3/bin"));
    knownPaths.push(path4.join(home, "miniconda3/bin"));
  }
  knownPaths.push(...getKnowGlobalSearchLocations());
  return knownPaths;
}
async function findCondaBinaryInKnownLocations() {
  const condaBinNames = getCondaBinNames();
  const knownLocations = getKnownCondaLocations();
  for (const location of knownLocations) {
    for (const binName of condaBinNames) {
      const condaPath = path4.join(location, binName);
      try {
        const stats = await fs4.stat(condaPath);
        if (stats.isFile() || stats.isSymbolicLink()) {
          return condaPath;
        }
      } catch (error) {
      }
    }
  }
  return void 0;
}
async function findCondaBinary() {
  const condaBinaryOnPath = await findCondaBinaryOnPath();
  return condaBinaryOnPath || await findCondaBinaryInKnownLocations();
}
async function getCondaVersion(condaBinary) {
  let parent = path4.dirname(condaBinary);
  if (parent.endsWith("bin")) {
    parent = path4.dirname(parent);
  }
  if (parent.endsWith("Library")) {
    parent = path4.dirname(parent);
  }
  const condaPythonJsonPath = await getCondaPackageJsonPath(parent, "conda") || await getCondaPackageJsonPath(path4.dirname(parent), "conda");
  return condaPythonJsonPath ? getVersionFromMetaJson(condaPythonJsonPath) : void 0;
}
async function getCondaEnvsFromEnvironmentTxt() {
  const envs = [];
  const home = process.env.USERPROFILE;
  if (home) {
    const environmentTxt = path4.join(home, ".conda", "environments.txt");
    try {
      const content = await fs4.readFile(environmentTxt, "utf-8");
      envs.push(...content.split("\n"));
    } catch (error) {
    }
  }
  return envs;
}
function getKnownEnvLocations(condaBin) {
  const paths = [];
  const home = process.env.USERPROFILE;
  if (home) {
    const condaEnvs = path4.join(home, ".conda", "envs");
    paths.push(condaEnvs);
  }
  const parent = path4.dirname(condaBin);
  if (parent) {
    paths.push(parent);
    const condaEnvs = path4.join(parent, "envs");
    paths.push(condaEnvs);
    const grandParent = path4.dirname(parent);
    if (grandParent) {
      paths.push(grandParent);
      paths.push(path4.join(grandParent, "envs"));
    }
  }
  return paths;
}
async function getCondaEnvsFromKnownEnvLocations(condaBin) {
  const envs = [];
  const locations = getKnownEnvLocations(condaBin);
  await Promise.all(locations.map(async (location) => {
    if (await isCondaEnvironment(location)) {
      envs.push(location);
    }
    try {
      const entries = fs4.readdirSync(location);
      for (const entry of entries) {
        const entryPath = path4.join(location, entry);
        const stats = fs4.statSync(entryPath);
        if (stats.isDirectory() && await isCondaEnvironment(entryPath)) {
          envs.push(entryPath);
        }
      }
    } catch (error) {
    }
  }));
  return envs;
}
async function getDistinctCondaEnvs(condaBin) {
  const [envs1, envs2] = await Promise.all([getCondaEnvsFromEnvironmentTxt(), getCondaEnvsFromKnownEnvLocations(condaBin)]);
  const envs = envs1.concat(envs2);
  envs.sort();
  const distinctEnvs = [];
  const locations = getKnownEnvLocations(condaBin);
  for (const env of envs) {
    let named = false;
    let name = "";
    for (const location of locations) {
      const envPath = path4.resolve(env);
      const locationPath = path4.resolve(location);
      if (envPath.startsWith(locationPath)) {
        named = true;
        name = path4.relative(locationPath, envPath) || "base";
        break;
      }
    }
    distinctEnvs.push({ named, name, path: env });
  }
  return distinctEnvs;
}
async function find3() {
  const condaBinary = await findCondaBinary();
  if (!condaBinary) {
    return void 0;
  }
  const condaVersion = await getCondaVersion(condaBinary);
  const manager = {
    executable_path: condaBinary,
    version: condaVersion,
    tool: 0 /* Conda */
  };
  const envs = await getDistinctCondaEnvs(condaBinary);
  if (envs.length === 0) {
    return { managers: [manager] };
  } else {
    const environments = [];
    await Promise.all(envs.map(async (env) => {
      const python_executable_path = await findPythonBinaryPath(env.path);
      const environment = {
        // named: env.named,
        name: env.name,
        env_path: env.path,
        python_executable_path,
        category: 2 /* Conda */,
        version: await getCondaPythonVersion(env.path),
        env_manager: manager,
        python_run_command: env.named ? [condaBinary, "run", "-n", env.name, "python"] : [condaBinary, "run", "-p", env.path, "python"]
      };
      environments.push(environment);
    }));
    return { environments };
  }
}

// src/global_virtualenvs.ts
var fs5 = __toESM(require_lib());
var path5 = __toESM(require("path"));
var import_os3 = require("os");
async function getGlobalVirtualenvDirs() {
  const venvDirs = [];
  const workOnHome = process.env.WORKON_HOME;
  if (workOnHome) {
    const canonicalizedPath = fs5.realpathSync(workOnHome);
    if (await fs5.pathExists(canonicalizedPath)) {
      venvDirs.push(canonicalizedPath);
    }
  }
  const home = (0, import_os3.homedir)();
  if (home) {
    const homePath = path5.resolve(home);
    const dirs = [
      path5.resolve(homePath, "envs"),
      path5.resolve(homePath, ".direnv"),
      path5.resolve(homePath, ".venvs"),
      path5.resolve(homePath, ".virtualenvs"),
      path5.resolve(homePath, ".local", "share", "virtualenvs")
    ];
    await Promise.all(dirs.map(async (dir) => {
      if (await fs5.pathExists(dir)) {
        venvDirs.push(dir);
      }
    }));
    if (process.platform === "linux") {
      const envs = path5.resolve(homePath, "Envs");
      if (await fs5.pathExists(envs)) {
        venvDirs.push(envs);
      }
    }
  }
  return venvDirs;
}
async function listGlobalVirtualEnvs() {
  const pythonEnvs = [];
  const venvDirs = await getGlobalVirtualenvDirs();
  await Promise.all(venvDirs.map(async (rootDir) => {
    const dirs = await fs5.readdir(rootDir);
    await Promise.all(dirs.map(async (venvDir) => {
      const venvPath = path5.resolve(rootDir, venvDir);
      if (!(await fs5.stat(venvPath)).isDirectory()) {
        return;
        ;
      }
      const executable = await findPythonBinaryPath(venvPath);
      if (executable) {
        pythonEnvs.push({
          executable,
          path: venvPath,
          version: await getVersion(executable)
        });
      }
    }));
  }));
  return pythonEnvs;
}

// src/pipenv.ts
var fs6 = __toESM(require_lib());
var path6 = __toESM(require("path"));
async function get_pipenv_project(env) {
  if (!env.path) {
    return;
  }
  const projectFile = path6.join(env.path, ".project");
  if (await fs6.pathExists(projectFile)) {
    const contents = await fs6.readFile(projectFile, "utf8");
    const projectFolder = contents.trim();
    if (await fs6.pathExists(projectFolder)) {
      return projectFolder;
    }
  }
  return void 0;
}
var PipEnv = class {
  async resolve(env) {
    const projectPath = await get_pipenv_project(env);
    if (projectPath) {
      return {
        python_executable_path: env.executable,
        version: env.version,
        category: 6 /* Pipenv */,
        env_path: env.path,
        project_path: projectPath
      };
    }
    return void 0;
  }
};

// src/virtualenvwrapper.ts
var path8 = __toESM(require("path"));
var fs8 = __toESM(require_lib());
var import_os4 = require("os");

// src/virtualenv.ts
var fs7 = __toESM(require_lib());
var path7 = __toESM(require("path"));
async function isVirtualenv(env) {
  if (!env.path) {
    return false;
  }
  const file_path = path7.dirname(env.executable);
  if (file_path) {
    if (await fs7.pathExists(path7.join(file_path, "activate")) || await fs7.pathExists(path7.join(file_path, "activate.bat"))) {
      return true;
    }
    try {
      const files = await fs7.readdir(file_path);
      for (const file of files) {
        if (file.startsWith("activate")) {
          return true;
        }
      }
    } catch (error) {
      return false;
    }
  }
  return false;
}
var VirtualEnv = class {
  async resolve(env) {
    if (await isVirtualenv(env)) {
      return {
        name: env.path && path7.dirname(env.path),
        python_executable_path: env.executable?.toString(),
        version: env.version,
        category: 9 /* VirtualEnv */,
        sys_prefix_path: env.path,
        env_path: env.path,
        env_manager: void 0,
        project_path: void 0,
        python_run_command: [env.executable?.toString()]
      };
    }
    return void 0;
  }
};

// src/virtualenvwrapper.ts
async function get_default_virtualenvwrapper_path() {
  if (process.platform === "win32") {
    const home = (0, import_os4.homedir)();
    if (home) {
      let homePath = path8.join(home, "Envs");
      if (await fs8.pathExists(homePath)) {
        return homePath;
      }
      homePath = path8.join(home, "virtualenvs");
      if (await fs8.pathExists(homePath)) {
        return homePath;
      }
    }
  } else {
    const home = (0, import_os4.homedir)();
    if (home) {
      const homePath = path8.join(home, "virtualenvs");
      if (await fs8.pathExists(homePath)) {
        return homePath;
      }
    }
  }
  return null;
}
async function get_work_on_home_path() {
  const work_on_home = process.env.WORKON_HOME;
  if (work_on_home) {
    const workOnHomePath = path8.resolve(work_on_home);
    if (await fs8.pathExists(workOnHomePath)) {
      return workOnHomePath;
    }
  }
  return get_default_virtualenvwrapper_path();
}
async function is_virtualenvwrapper(env) {
  if (!env.path) {
    return false;
  }
  const work_on_home_dir = await get_work_on_home_path();
  if (work_on_home_dir && env.executable.startsWith(work_on_home_dir) && await isVirtualenv(env)) {
    return true;
  }
  return false;
}
var VirtualEnvWrapper = class {
  async resolve(env) {
    if (await is_virtualenvwrapper(env)) {
      return {
        name: env.path && path8.basename(env.path),
        python_executable_path: env.executable,
        version: env.version,
        category: 8 /* Venv */,
        sys_prefix_path: env.path,
        env_path: env.path,
        python_run_command: [env.executable]
      };
    }
  }
  async find() {
    const work_on_home = await get_work_on_home_path();
    if (work_on_home) {
      const envs = await listPythonEnvironments(work_on_home) || [];
      const environments = [];
      await Promise.all(envs.map(async (env) => {
        const resolvedEnv = await this.resolve(env);
        if (resolvedEnv) {
          environments.push(resolvedEnv);
        }
      }));
      if (environments.length === 0) {
        return;
      }
      return { environments };
    }
  }
};

// src/venv.ts
var path9 = __toESM(require("path"));
async function isVenv(env) {
  if (!env.path) {
    return false;
  }
  return await findPyvenvConfigPath(env.executable) !== void 0;
}
var Venv = class {
  async resolve(env) {
    if (await isVenv(env)) {
      return {
        name: env.path && path9.basename(env.path),
        python_executable_path: env.executable,
        version: env.version,
        category: 8 /* Venv */,
        sys_prefix_path: env.path,
        env_path: env.path,
        env_manager: void 0,
        project_path: void 0,
        python_run_command: [env.executable]
      };
    }
    return void 0;
  }
};

// src/main.ts
async function main() {
  const started = Date.now();
  console.log("Starting async function");
  const environments = [];
  const [pyenvs, homebrews, condas] = await Promise.all([find(), find2(), find3()]);
  if (pyenvs?.environments) {
    environments.push(...pyenvs.environments);
  }
  if (homebrews?.environments) {
    environments.push(...homebrews.environments);
  }
  if (condas?.environments) {
    environments.push(...condas.environments);
  }
  const found = /* @__PURE__ */ new Set();
  environments.forEach((e) => {
    found.add(e.python_executable_path || e.env_path || "");
  });
  const pipEnv = new PipEnv();
  const virtualEnvWrapper = new VirtualEnvWrapper();
  const virtualEnv = new VirtualEnv();
  const venv = new Venv();
  const globalVenvs = await listGlobalVirtualEnvs();
  await Promise.all(
    globalVenvs.map(async (env) => {
      if (found.has(env.executable || env.path || "")) {
        return;
      }
      let resolved = await pipEnv.resolve(env);
      if (resolved) {
        found.add(resolved.python_executable_path || resolved.env_path || "");
        environments.push(resolved);
        return;
      }
      resolved = await virtualEnvWrapper.resolve(env);
      if (resolved) {
        found.add(resolved.python_executable_path || resolved.env_path || "");
        environments.push(resolved);
        return;
      }
      resolved = await venv.resolve(env);
      if (resolved) {
        found.add(resolved.python_executable_path || resolved.env_path || "");
        environments.push(resolved);
        return;
      }
      resolved = await virtualEnv.resolve(env);
      if (resolved) {
        found.add(resolved.python_executable_path || resolved.env_path || "");
        environments.push(resolved);
        return;
      }
    })
  );
  const completion_time = Date.now() - started;
  console.log(`Async function completed in ${completion_time}ms`);
  console.log(JSON.stringify(environments, void 0, 4));
  console.log(`Async function completed in ${completion_time}ms`);
}
main();
//# sourceMappingURL=index.js.map
