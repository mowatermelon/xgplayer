'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _xgplayer = require('xgplayer');

var _xgplayer2 = _interopRequireDefault(_xgplayer);

var _xgplayerTransmuxerContext = require('xgplayer-transmuxer-context');

var _xgplayerTransmuxerContext2 = _interopRequireDefault(_xgplayerTransmuxerContext);

var _xgplayerTransmuxerConstantEvents = require('xgplayer-transmuxer-constant-events');

var _xgplayerTransmuxerConstantEvents2 = _interopRequireDefault(_xgplayerTransmuxerConstantEvents);

var _flvLiveMobile = require('./flv-live-mobile');

var _flvLiveMobile2 = _interopRequireDefault(_flvLiveMobile);

require('xgplayer-mobilevideo');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var flvAllowedEvents = _xgplayerTransmuxerConstantEvents2.default.FlvAllowedEvents;

var FlvPlayer = function (_Player) {
  _inherits(FlvPlayer, _Player);

  function FlvPlayer(config) {
    _classCallCheck(this, FlvPlayer);

    if (!config.mediaType) {
      config.mediaType = 'mobile-video';
    }

    var _this = _possibleConstructorReturn(this, (FlvPlayer.__proto__ || Object.getPrototypeOf(FlvPlayer)).call(this, config));

    if (!_this.playerInited) {
      _this.initPlayer(config);
    }
    return _this;
  }

  _createClass(FlvPlayer, [{
    key: 'initPlayer',
    value: function initPlayer() {
      this.video.width = Number.parseInt(this.config.width || 600);
      this.video.height = Number.parseInt(this.config.height || 337.5);
      this.video.style.outline = 'none';
      this.context = new _xgplayerTransmuxerContext2.default(flvAllowedEvents);
      this.initEvents();
      this.playerInited = true;
    }
  }, {
    key: 'start',
    value: function start() {
      if (!this.playerInited) {
        this.initPlayer();
      }
      this.initFlv();
      this.context.init();
      this.flv.seek(0);
      _get(FlvPlayer.prototype.__proto__ || Object.getPrototypeOf(FlvPlayer.prototype), 'start', this).call(this, this.config.url);
      this.play();
    }
  }, {
    key: 'initFlvEvents',
    value: function initFlvEvents(flv) {
      var player = this;

      flv.once(_xgplayerTransmuxerConstantEvents2.default.LOADER_EVENTS.LOADER_COMPLETE, function () {
        // 直播完成，待播放器播完缓存后发送关闭事件
        if (!player.paused) {
          var timer = setInterval(function () {
            var end = player.getBufferedRange()[1];
            if (Math.abs(player.currentTime - end) < 0.5) {
              player.emit('ended');
              window.clearInterval(timer);
            }
          }, 200);
        }
      });
    }
  }, {
    key: 'initEvents',
    value: function initEvents() {
      var _this2 = this;

      this.on('timeupdate', function () {
        _this2.loadData();
      });

      this.on('seeking', function () {
        var time = _this2.currentTime;
        var range = _this2.getBufferedRange();
        if (time > range[1] || time < range[0]) {
          _this2.flv.seek(_this2.currentTime);
        }
      });
    }
  }, {
    key: 'initFlv',
    value: function initFlv() {
      var flv = this.context.registry('FLV_CONTROLLER', _flvLiveMobile2.default)(this);
      this.initFlvEvents(flv);
      this.flv = flv;
    }
  }, {
    key: 'play',
    value: function play() {
      if (this._hasStart && this.paused) {
        this._destroy();
        this.context = new _xgplayerTransmuxerContext2.default(flvAllowedEvents);
        var flv = this.context.registry('FLV_CONTROLLER', _flvLiveMobile2.default)(this);
        this.initFlvEvents(flv);
        this.flv = flv;
        this.context.init();
        this.loadData();
        _get(FlvPlayer.prototype.__proto__ || Object.getPrototypeOf(FlvPlayer.prototype), 'start', this).call(this);
        _get(FlvPlayer.prototype.__proto__ || Object.getPrototypeOf(FlvPlayer.prototype), 'play', this).call(this);
      } else {
        _get(FlvPlayer.prototype.__proto__ || Object.getPrototypeOf(FlvPlayer.prototype), 'play', this).call(this);
        this.addLiveFlag();
      }
    }
  }, {
    key: 'pause',
    value: function pause() {
      _get(FlvPlayer.prototype.__proto__ || Object.getPrototypeOf(FlvPlayer.prototype), 'pause', this).call(this);
      if (this.flv) {
        this.flv.pause();
      }
    }
  }, {
    key: 'loadData',
    value: function loadData() {
      var time = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.currentTime;

      if (this.flv) {
        this.flv.seek(time);
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this._destroy();
      _get(FlvPlayer.prototype.__proto__ || Object.getPrototypeOf(FlvPlayer.prototype), 'destroy', this).call(this);
    }
  }, {
    key: 'addLiveFlag',
    value: function addLiveFlag() {
      var player = this;
      _xgplayer2.default.util.addClass(player.root, 'xgplayer-is-live');
      if (!_xgplayer2.default.util.findDom(this.root, 'xg-live')) {
        var live = _xgplayer2.default.util.createDom('xg-live', '正在直播', {}, 'xgplayer-live');
        player.controls.appendChild(live);
      }
    }
  }, {
    key: '_destroy',
    value: function _destroy() {
      this.context.destroy();
      this.flv = null;
      this.context = null;
    }
  }, {
    key: 'src',
    get: function get() {
      return this.currentSrc;
    },
    set: function set(url) {
      var _this3 = this;

      this.player.config.url = url;
      if (!this.paused) {
        this.pause();
        this.once('pause', function () {
          _this3.start(url);
        });
        this.once('canplay', function () {
          _this3.play();
        });
      } else {
        this.start(url);
      }
      this.once('canplay', function () {
        _this3.currentTime = 0;
      });
    }
  }]);

  return FlvPlayer;
}(_xgplayer2.default);

exports.default = FlvPlayer;