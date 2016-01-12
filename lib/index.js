"use strict";

var https = require("https");
var EventEmitter = require("events").EventEmitter;
var Bluebird = require("bluebird");
var util = require("util");
var request = Bluebird.promisifyAll(require("request"));
var querystring = require("querystring");

var streamUrl = "https://stream.steambots.io";
var apiUrl = "https://api.steambots.io";
var reconnectDelay = 6000;

function SteamBots(apiKey) {
  this.apiKey = apiKey;
  this.stream = null;
  this.streamReconnectTimeout = null;
};

util.inherits(SteamBots, EventEmitter);

SteamBots.prototype.openStream = function(sinceId) {

  var self = this;

  this.closeStream();

  var url = streamUrl + "?key=" + this.apiKey;

  if (sinceId) {
    url += "&since_id=" + sinceId;
  }

  // buffer data until we hit a linebreak, then parse and emit
  var buffer = "";
  this.stream = https.get(url, function(res) {
    res.on("data", function(data) {
      buffer += data.toString("utf8");
      while ((index = buffer.indexOf("\r\n")) !== -1) {
        var message = buffer.slice(0, index);
        index += 2;
        var packet = JSON.parse(message);
        sinceId = packet.id;
        self.emit("data", packet);
        self.emit(packet.type, packet);
        buffer = buffer.substring(index);
      }
    });

    // if the stream ends wait a while and reconnect
    res.on("end", function() {
      clearTimeout(this.streamReconnectTimeout);
      this.streamReconnectTimeout = setTimeout(function() {
        self.openStream(sinceId);
      }, reconnectDelay);
    });
  });

  // if error is thrown while aborting lets just ensure that self.stream is null
  this.stream.on("error", function(e) {
    self.stream = null;
  });

};

SteamBots.prototype.closeStream = function() {
  clearTimeout(this.streamReconnectTimeout);
  if (this.stream !== null) {
    this.stream.abort();
    this.stream = null;
  }
};

SteamBots.prototype.callAPI = function(options) {

  options.params = options.params || {};

  var method = request[options.method.toLowerCase() + "Async"];
  return method({
    uri: apiUrl + options.uri + "?" + querystring.stringify(options.params),
    json: true,
    body: options.body,
    headers: {
      "Key": this.apiKey
    }
  })
  .spread(function(response, body) {
    if (response.statusCode !== 200) {
      throw body;
    }
    return body;
  });
};

SteamBots.prototype.getBots = function(callback) {
  return this.callAPI({
    method: "get",
    uri: "/bots",
  }).nodeify(callback);
}

SteamBots.prototype.getTrades = function(options, callback) {
  
  if (util.isFunction(options)) {
    callback = options;
    options = {};
  }

  if (options == null) {
    options = {};
  }

  if (!util.isObject(options)) {
    throw new Error("Expected getTrades(0) (options) to be an object");
  }

  return this.callAPI({
    method: "get",
    uri: "/trades",
    params: options
  }).nodeify(callback);
};

SteamBots.prototype.getTrade = function(tradeId, callback) {
  return this.callAPI({
    method: "get",
    uri: "/trades/" + tradeId,
  }).nodeify(callback);
};

SteamBots.prototype.resendTrade = function(tradeLink, tradeId, callback) {
  
  var options = {};
  
  if (tradeLink) {
    options.trade_link = tradeLink;
  }

  return this.callAPI({
    method: "post",
    uri: "/trades/" + tradeId + "/resend",
    body: options
  }).nodeify(callback);
};

SteamBots.prototype.createDeposit = function(tradeLink, assetIds, callback) {
  
  if (!util.isString(tradeLink)) {
    throw new Error("Expected deposit(0) (tradeLink) to be a string");
  }

  if (!util.isArray(assetIds)) {
    throw new Error("Expected deposit(1) (assetIds) to be an array");
  }

  return this.callAPI({
    method: "post",
    uri: "/deposits",
    body: {
      trade_link: tradeLink,
      asset_ids: assetIds
    }
  }).nodeify(callback);
};

SteamBots.prototype.createWithdrawal = function(tradeLink, itemIds, callback) {

  if (!util.isString(tradeLink)) {
    throw new Error("Expected withdraw(0) (tradeLink) to be a string");
  }

  if (!util.isArray(itemIds)) {
    throw new Error("Expected withdraw(1) (itemIds) to be an array");
  }

 return this.callAPI({
    method: "post",
    uri: "/withdrawals",
    body: {
      trade_link: tradeLink,
      item_ids: itemIds
    }
  }).nodeify(callback);
};

SteamBots.prototype.loadInventory = function(steamId, callback) {
  return this.callAPI({
    method: "get",
    uri: "/inventory/" + steamId,
  }).nodeify(callback);
};

SteamBots.prototype.getItems = function(options, callback) {
  return this.callAPI({
    method: "get",
    uri: "/items",
    params: options
  }).nodeify(callback);
};

module.exports = SteamBots;
