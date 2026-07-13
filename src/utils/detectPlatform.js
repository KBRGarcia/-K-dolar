/**
 * Detecta el sistema del dispositivo desde el navegador.
 * iPadOS 13+ puede reportarse como Mac; se distingue con touch points.
 */
export function detectPlatform() {
  if (typeof navigator === 'undefined') {
    return { isAndroid: false, isApple: false, isIOS: false, label: 'other' }
  }

  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const maxTouchPoints = navigator.maxTouchPoints || 0

  const isAndroid = /Android/i.test(ua)
  const isClassicIos = /iPhone|iPad|iPod/i.test(ua)
  const isIpadOsDesktopUa =
    platform === 'MacIntel' && maxTouchPoints > 1 && !isAndroid
  const isIOS = isClassicIos || isIpadOsDesktopUa
  const isApple = isIOS || (/Macintosh|Mac OS X/i.test(ua) && !isAndroid)

  let label = 'other'
  if (isAndroid) label = 'android'
  else if (isIOS) label = 'ios'
  else if (isApple) label = 'apple'

  return { isAndroid, isApple, isIOS, label }
}
