import Plugin, {Events, Util} from '../../plugin'
import Touche from './touch'
import SeekTipIcon from './seekicon.svg'
// import BackSvg from './back.svg'

const ACTIONS = {
  AUTO: 'auto',
  SEEKING: 'seeking',
  PLAYBACK: 'playbackrate',
  LIGHT: ''
}

class MobilePlugin extends Plugin {
  static get pluginName () {
    return 'mobile'
  }

  static get defaultConfig () {
    return {
      stopPropagation: true, // 是否阻止冒泡
      index: 0,
      disableGesture: false, // 是否禁用手势
      gestureX: true, // 是否启用水平手势
      gestureY: true, // 是否启用垂直手势
      updateGesture: () => {}, // 手势处理回调
      onTouchStart: () => {}, // 手势开始移动回调
      onTouchEnd: () => {}, // 手势移动结束回调
      gradient: 'normal', // 是否启用阴影
      isTouchingSeek: false, // 是否在touchMove的同时更新currentTime
      miniMoveStep: 5, // 最小差异，用于move节流
      scopeL: 0.25, // 左侧手势范围比例
      scopeR: 0.25, // 右侧手势范围比例
      scopeM: 0.9, // 中间手势范围比例
      pressRate: 2, // 长按快进倍速
      darkness: true, // 是否启用右侧调暗功能
      maxDarkness: 0.8, // 调暗最大暗度，即蒙层最大透明度
      disableActive: false, // 是否禁用时间面板
      disableTimeProgress: false, // 是否禁用时间进度条
      hideControlsActive: false, // 手势拖动的时候是否隐控制栏
      hideControlsEnd: true, // 手势结束的时候隐控制栏
      moveDuration: 60 * 6 * 1000, // 视频区对应的时长
      closedbClick: false, // 是否关闭双击手势
      disablePress: true // 是否关闭长按手势
    }
  }

  constructor (options) {
    super(options)
    this.pos = {
      x: 0,
      y: 0,
      time: 0,
      volume: 0,
      rate: 1,
      light: 0,
      width: 0,
      height: 0,
      scopeL: 0,
      scopeR: 0,
      scopeM1: 0,
      scopeM2: 0,
      scope: -1
    }
  }

  registerIcons () {
    return {
      seekTipIcon: {icon: SeekTipIcon, class: 'xg-seek-pre'}
    }
  }

  afterCreate () {
    const {playerConfig, config, player} = this
    this.resetPos()
    if (!Util.isUndefined(playerConfig.disableGesture)) {
      config.disableGesture = !!playerConfig.disableGesture
    }
    this.appendChild('.xg-seek-icon', this.icons.seekTipIcon)

    this.xgMask = Util.createDom('xg-mask', '', {}, 'xgmask')
    player.root.appendChild(this.xgMask)

    this.initCustomStyle()

    this.registerThumbnail()
    this.touch = new Touche(this.root)

    this.root.addEventListener('contextmenu', e => {
      e.preventDefault()
    });

    this.on(Events.DURATION_CHANGE, () => {
      const {player, config} = this
      if (player.duration * 1000 < config.moveDuration) {
        config.moveDuration = player.duration * 1000
      }
    })

    this.on([Events.CANPLAY, Events.ENDED], () => {
      const {time, isStart} = this.pos
      if (!isStart && time > 0) {
        this.pos.time = 0
      }
    })

    const eventsMap = {
      'touchstart': 'onTouchStart',
      'touchmove': 'onTouchMove',
      'touchend': 'onTouchEnd',
      'press': 'onPress',
      'pressend': 'onPressEnd',
      'click': 'onClick',
      'doubleclick': 'onDbClick'
    }

    Object.keys(eventsMap).map(key => {
      this.touch.on(key, (e) => {
        this[eventsMap[key]](e)
      })
    })

    player.root.addEventListener('touchmove', this.onRootTouchMove, true)
    player.root.addEventListener('touchend', this.onRootTouchEnd, true)

    if (!config.disableActive) {
      // 添加进度条拖拽事件回调
      const progressPlugin = player.plugins.progress
      if (progressPlugin) {
        progressPlugin.addCallBack('dragmove', (data) => {
          this.activeSeekNote(data.currentTime, data.forward)
        })
        progressPlugin.addCallBack('dragend', () => {
          this.changeAction(ACTIONS.AUTO)
        })
      }
    }
  }

  registerThumbnail () {
    const {player} = this
    const {thumbnail} = player.plugins
    if (thumbnail && thumbnail.usable) {
      this.thumbnail = thumbnail.createThumbnail(null, 'mobile-thumbnail')
      const timePreview = this.find('.time-preview')
      timePreview.insertBefore(this.thumbnail, timePreview.children[0])
    }
  }

  initCustomStyle () {
    const {commonStyle} = this.playerConfig || {}
    const {playedColor, progressColor} = commonStyle
    if (playedColor) {
      this.find('.curbar').style.backgroundColor = playedColor
      this.find('.cur').style.color = playedColor
    }
    if (progressColor) {
      this.find('.bar').style.backgroundColor = progressColor
      this.find('.time-preview').style.color = progressColor
    }
    this.config.disableTimeProgress && Util.addClass(this.find('.bar'), 'hide')
  }

  resetPos (time = 0) {
    if (this.pos) {
      this.pos.isStart = false
      this.pos.scope = -1;
      ['x', 'y', 'width', 'height', 'scopeL', 'scopeR', 'scopeM1', 'scopeM2'].map(item => {
        this.pos[item] = 0
      })
    } else {
      this.pos = {
        isStart: false,
        x: 0,
        y: 0,
        volume: 0,
        rate: 1,
        light: 0,
        width: 0,
        height: 0,
        scopeL: 0,
        scopeR: 0,
        scopeM1: 0,
        scopeM2: 0,
        scope: -1,
        time: time
      }
    }
  }

  changeAction (action) {
    const {player, root} = this
    root.setAttribute('data-xg-action', action)
    const startPlugin = player.plugins.start
    startPlugin && startPlugin.recover()
  }

  getTouche (touches) {
    const rotateDeg = this.player.rotateDeg
    if (touches && touches.length > 0) {
      const touche = touches[touches.length - 1]
      if (rotateDeg === 0) {
        return {
          pageX: touche.pageX,
          pageY: touche.pageY
        }
      } else {
        return {
          pageX: touche.pageY,
          pageY: touche.pageX
        }
      }
    } else {
      return null
    }
  }
  /**
   * 校验具体的操作范围
   * @param {number} x 方向位移
   * @param {number} width 当前操作区域宽度
   * @param {number} mold 位移绝对值
   * @return {number} scope 区域 0=>中间x方向滑动  1=>左侧上下滑动 2=>右侧上下滑动
   */
  checkScope (x, width, mold) {
    const {pos} = this
    let scope = -1
    if (x < 0 || x > width) {
      return scope
    }
    if (mold >= 1 && x > pos.scopeM1 && x < pos.scopeM2) {
      scope = 0
    } else if (mold < 1) {
      scope = x < pos.scopeL ? 1 : (x > pos.scopeR ? 2 : scope)
    }
    return scope
  }

  /**
   * 根据位移和操作类型进行对应处理
   * @param {number} x x方向位移
   * @param {number} y y方向位移
   * @param {number} scope scope 区域 0=>中间x方向滑动  1=>左侧上下滑动 2=>右侧上下滑动
   * @param {number} width 总体宽度
   * @param {number} height 总高度
   */
  executeMove (diffx, diffy, scope, width, height) {
    switch (scope) {
      case 0:
        this.updateTime(diffx / width * this.config.scopeM)
        break
      case 1:
        this.updateBrightness(diffy / height)
        break
      case 2:
        this.updateVolume(diffy / height)
        break
      default:
    }
  }

  endLastMove (scope, lastScope) {
    const {pos, player, config} = this
    if (scope !== lastScope) {
      switch (lastScope) {
        case 0:
          const time = pos.time / 1000
          player.seek(Number(time).toFixed(1))
          this.changeAction(ACTIONS.AUTO)
          config.hideControlsEnd ? player.emit(Events.PLAYER_BLUR) : player.emit(Events.PLAYER_FOCUS)
          break
        case 1:
        case 2:
        default:
      }
    }
  }

  onTouchStart = (e) => {
    e.cancelable && e.preventDefault()
    const {player, config, pos, playerConfig} = this
    const touche = this.getTouche(e.touches)
    if (touche && !config.disableGesture && player.duration > 0 && !player.ended) {
      pos.isStart = true
      Util.checkIsFunction(playerConfig.disableSwipeHandler) && playerConfig.disableSwipeHandler()
      this.find('.dur').innerHTML = Util.format(player.duration)
      pos.x = parseInt(touche.pageX, 10)
      pos.y = parseInt(touche.pageY, 10)
      !pos.time && (pos.time = player.currentTime * 1000)
      pos.volume = player.volume * 100
      const rect = this.root.getBoundingClientRect()
      pos.width = player.rotateDeg === 90 ? rect.height : rect.width
      pos.height = player.rotateDeg === 90 ? rect.width : rect.height
      pos.scopeL = config.scopeL * pos.width
      pos.scopeR = (1 - config.scopeR) * pos.width
      pos.scopeM1 = pos.width * (1 - config.scopeM) / 2
      pos.scopeM2 = pos.width - pos.scopeM1
    }
  }

  onTouchMove = (e) => {
    e.preventDefault()
    const touche = this.getTouche(e.touches)
    const {pos, config, player} = this
    if (!touche || config.disableGesture || !player.duration) {
      return
    }
    const {miniMoveStep, hideControlsActive} = config
    if (Math.abs(touche.pageX - pos.x) > miniMoveStep || Math.abs(touche.pageY - pos.y) > miniMoveStep) {
      const x = parseInt(touche.pageX, 10)
      const y = parseInt(touche.pageY, 10)
      const diffx = x - pos.x
      const diffy = y - pos.y
      // console.log(`y:${y} diffy:${diffy} pos.y:${pos.y}`)
      const scope = this.checkScope(x, pos.width, Math.abs(diffx / diffy))
      if (scope > 0 && !config.gestureY) {
        return
      }
      if (scope === 0 && !config.gestureX) {
        return
      }
      if (scope === 0 && scope !== pos.scope) {
        !hideControlsActive ? player.emit(Events.PLAYER_FOCUS, {autoHide: false}) : player.emit(Events.PLAYER_BLUR)
      }
      this.endLastMove(scope, pos.scope)
      this.executeMove(diffx, diffy, scope, pos.width, pos.height)
      pos.scope = scope
      pos.x = x
      pos.y = y
    } else {
      // console.log('touche.pageX - pos.x', touche.pageX - pos.x)
    }
  }

  onTouchEnd = (e) => {
    e.preventDefault()
    const {player, pos, config, playerConfig} = this
    if (!pos.isStart) {
      return
    }
    const time = pos.time / 1000
    if (pos.scope === 0) {
      player.seek(Number(time).toFixed(1))
      config.hideControlsEnd ? player.emit(Events.PLAYER_BLUR) : player.emit(Events.PLAYER_FOCUS)
    }
    setTimeout(() => {
      player.getPlugin('progress') && player.getPlugin('progress').resetSeekState()
    }, 10)
    pos.scope = -1
    this.resetPos()
    Util.checkIsFunction(playerConfig.enableSwipeHandler) && playerConfig.enableSwipeHandler()
    this.changeAction(ACTIONS.AUTO)
  }

  onRootTouchMove = (e) => {
    const {plugins} = this.player
    if (plugins && plugins.start.root.contains(e.target)) {
      e.stopPropagation()
      if (!this.pos.isStart) {
        this.onTouchStart(e)
      } else {
        this.onTouchMove(e)
      }
    }
  }

  onRootTouchEnd = (e) => {
    const {plugins} = this.player
    if (this.pos.isStart && plugins.start && plugins.start.root.contains(e.target)) {
      e.stopPropagation()
      this.onTouchEnd(e)
    }
  }

  onClick (e) {
    const {player, config, playerConfig} = this
    if (!player.isPlaying) {
      !playerConfig.closeVideoClick && player.play()
      return
    }

    if (!config.closedbClick || playerConfig.closeVideoClick) {
      player.isActive ? player.emit(Events.PLAYER_BLUR) : player.emit(Events.PLAYER_FOCUS)
    } else if (!playerConfig.closeVideoClick) {
      player.isActive ? this.switchPlayPause() : player.emit(Events.PLAYER_FOCUS)
    }
  }

  onDbClick (e) {
    const {config, player} = this
    if (!config.closedbClick && player.isPlaying) {
      this.switchPlayPause()
    }
  }

  onPress (e) {
    const {pos, config, player} = this
    if (config.disablePress) {
      return
    }
    pos.rate = this.player.playbackRate
    player.playbackRate = config.pressRate
    this.changeAction(ACTIONS.PLAYBACK)
  }

  onPressEnd (e) {
    const {pos, config, player} = this
    if (config.disablePress) {
      return
    }
    player.playbackRate = pos.rate
    pos.rate = 1
    this.changeAction(ACTIONS.AUTO)
  }

  updateTime (percent) {
    const {player, config} = this
    const {duration} = this.player
    percent = Number(percent.toFixed(4))
    let time = parseInt(percent * config.moveDuration, 10)
    time += this.pos.time
    time = time < 0 ? 0 : (time > duration * 1000 ? duration * 1000 : time)
    player.getPlugin('time') && player.getPlugin('time').updateTime(time / 1000)
    player.getPlugin('progress') && player.getPlugin('progress').updatePercent(time / 1000 / duration, true)
    this.activeSeekNote(time / 1000, percent > 0)
    // 在滑动的同时实时seek
    if (this.config.isTouchingSeek) {
      // player.currentTime = time / 1000
      player.seek(Number(time / 1000).toFixed(1))
    }
    this.pos.time = time
  }

  updateVolume (percent) {
    const {pos, player} = this
    percent = parseInt(percent * 100, 10)
    const volume = pos.volume - percent
    pos.volume = volume < 1 ? 0 : (volume > 100 ? 100 : volume)
    if (Math.abs(pos.volume - player.volume * 100) >= 10) {
      player.volume = pos.volume / 100
    }
  }

  updateBrightness (percent) {
    const {pos, config, xgMask} = this
    let light = pos.light + (0.8 * percent)
    light = light > config.maxDarkness ? config.maxDarkness : (light < 0 ? 0 : light)
    if (xgMask) {
      xgMask.style.backgroundColor = `rgba(0,0,0,${light})`
    }
    pos.light = light
  }

  activeSeekNote (time, isForward = true) {
    const {player, config} = this
    const isLive = !(player.duration !== Infinity && player.duration > 0)
    if (!time || typeof time !== 'number' || isLive || config.disableActive) {
      return
    }
    if (time < 0) {
      time = 0
    } else if (time > this.player.duration) {
      time = this.player.duration
    }
    this.changeAction(ACTIONS.SEEKING)

    const startPlugin = player.plugins.start
    startPlugin && startPlugin.focusHide()

    this.find('.dur').innerHTML = Util.format(player.duration)
    this.find('.cur').innerHTML = Util.format(time)
    this.find('.curbar').style.width = `${time / player.duration * 100}%`
    if (isForward) {
      Util.removeClass(this.find('.seek-show'), 'back')
    } else {
      Util.addClass(this.find('.seek-show'), 'back')
    }
    this.updateThumbnails(time)
    // const {thumbnail} = player.plugins
    // this.thumbnailPlugin && thumbnail.update(time)
  }

  updateThumbnails (time) {
    const {player} = this
    const {thumbnail} = player.plugins
    if (thumbnail && thumbnail.usable) {
      this.thumbnail && thumbnail.update(this.thumbnail, time, 160, 90)
      // this.videothumbnail && thumbnail.update(this.videothumbnail, time, rect.width, rect.height)
    }
  }

  switchPlayPause () {
    const {player} = this
    if (!player.hasStart) {
      return false
    } else if (!player.ended) {
      if (player.paused) {
        player.play()
      } else {
        player.pause()
      }
    }
  }

  destroy () {
    const {player} = this
    this.thumbnail = null
    player.root.removeChild(this.xgMask)
    this.xgMask = null
    this.touch && this.touch.destroy()
    this.touch = null
    player.root.removeEventListener('touchmove', this.onRootTouchMove, true)
    player.root.removeEventListener('touchend', this.onRootTouchEnd, true)
  }

  render () {
    const className = this.config.gradient !== 'normal' ? `gradient ${this.config.gradient}` : 'gradient'
    return `
     <xg-trigger class="trigger">
     <div class="${className}"></div>
        <div class="time-preview">
            <div class="seek-show">
              <i class="xg-seek-icon"></i>
              <span class="cur">00:00</span>
              <span>/</span>
              <span class="dur">00:00</span>
            </div>
              <div class="bar timebar">
                <div class="curbar"></div>
              </div>
        </div>
        <div class="xg-playbackrate xg-top-note">
            <span><i>${this.config.pressRate}X</i>快进中</span>
        </div>
     </xg-trigger>
    `
  }
}

export default MobilePlugin
