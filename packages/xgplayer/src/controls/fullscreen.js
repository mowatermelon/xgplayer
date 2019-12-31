import Player from '../player'

let fullscreen = function () {
  let player = this
  let root = player.root
  let util = Player.util

  function onFullscreenBtnClick () {
    if (util.hasClass(root, 'xgplayer-is-fullscreen')) {
      player.exitFullscreen(root)
    } else {
      player.getFullscreen(root)
    }
  }
  player.on('fullscreenBtnClick', onFullscreenBtnClick)

  function onFullscreenChange () {
    let fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement
    if (fullscreenEl && fullscreenEl === root) {
      util.addClass(root, 'xgplayer-is-fullscreen')
      player.emit('requestFullscreen')
    } else {
      util.removeClass(root, 'xgplayer-is-fullscreen')
      player.emit('exitFullscreen')
    }
  };
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(item => {
    document.addEventListener(item, onFullscreenChange)
  })

  function onDestroy () {
    player.off('fullscreenBtnClick', onFullscreenBtnClick);
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(item => {
      document.removeEventListener(item, onFullscreenChange)
    })
    player.off('destroy', onDestroy)
  }
  player.once('destroy', onDestroy)
}

Player.install('fullscreen', fullscreen)
