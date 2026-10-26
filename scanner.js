/* Mart360 live barcode camera scanner. Exact inventory matching is required before adding an item. */
const cameraScanner = {
  active: false,
  token: 0,
  stream: null,
  track: null,
  controls: null,
  detector: null,
  zxing: null,
  timer: null,
  busy: false,
  candidate: '',
  hits: 0,
  locked: false,
  lockedCode: '',
  blankFrames: 0,
  acceptedAt: 0,
  torchOn: false,
};
const cameraScanFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];
function cameraScanStatus(message, tone = '') {
  const el = document.querySelector('#scanStatus');
  if (!el) return;
  el.textContent = message;
  el.className = 'scan-status' + (tone ? ' ' + tone : '');
}
function barcodeCheckDigitValid(code, bodyLength) {
  if (!new RegExp('^\\d{' + (bodyLength + 1) + '}$').test(code)) return false;
  const body = code.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[i]) * (((body.length - 1 - i) % 2 === 0) ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(code.at(-1));
}
function upceChecksumValid(code) {
  if (!/^\d{8}$/.test(code) || !/^[01]$/.test(code[0])) return false;
  const ns = code[0], a = code.slice(1, 7), last = a[5];
  let upca;
  if ('012'.includes(last)) upca = ns + a.slice(0, 2) + last + '0000' + a.slice(2, 5);
  else if (last === '3') upca = ns + a.slice(0, 3) + '00000' + a.slice(3, 5);
  else if (last === '4') upca = ns + a.slice(0, 4) + '00000' + a[4];
  else upca = ns + a.slice(0, 5) + '0000' + last;
  return barcodeCheckDigitValid(upca + code[7], 11);
}
function cameraBarcodeIsValid(code, format) {
  const fmt = String(format || '').toUpperCase().replaceAll('-', '_');
  if (fmt === 'EAN_13') return barcodeCheckDigitValid(code, 12);
  if (fmt === 'EAN_8') return barcodeCheckDigitValid(code, 7);
  if (fmt === 'UPC_A') return barcodeCheckDigitValid(code, 11);
  if (fmt === 'UPC_E') return upceChecksumValid(code);
  if (fmt === 'ITF') return /^\d{6,14}$/.test(code) && code.length % 2 === 0 && (code.length !== 14 || barcodeCheckDigitValid(code, 13));
  if (fmt === 'CODE_128') return code.length > 0 && code.length <= 80 && /^[\x20-\x7E]+$/.test(code);
  // ZXing builds may return a numeric enum instead of the format name.
  // Infer only numeric retail formats by length/checksum; final inventory matching remains exact.
  if (/^\d+$/.test(code)) {
    if (code.length === 13) return barcodeCheckDigitValid(code, 12);
    if (code.length === 12) return barcodeCheckDigitValid(code, 11);
    if (code.length === 8) return barcodeCheckDigitValid(code, 7) || upceChecksumValid(code);
    if (code.length === 14) return barcodeCheckDigitValid(code, 13);
    return code.length >= 6 && code.length <= 14 && code.length % 2 === 0;
  }
  return code.length > 0 && code.length <= 80 && /^[\x20-\x7E]+$/.test(code);
}
function stopCameraStreamOnly() {
  if (cameraScanner.timer) clearTimeout(cameraScanner.timer);
  cameraScanner.timer = null;
  try { cameraScanner.controls?.stop?.(); } catch {}
  cameraScanner.controls = null;
  try { cameraScanner.stream?.getTracks().forEach(track => track.stop()); } catch {}
  cameraScanner.stream = null;
  cameraScanner.track = null;
  cameraScanner.detector = null;
  cameraScanner.busy = false;
  cameraScanner.torchOn = false;
  const video = document.querySelector('#scanVideo');
  if (video) { try { video.pause(); } catch {} video.srcObject = null; }
  const torch = document.querySelector('#scanTorchBtn');
  if (torch) torch.hidden = true;
}
function stopCameraScanner() {
  cameraScanner.active = false;
  cameraScanner.token++;
  stopCameraStreamOnly();
}
function closeCameraScanner() {
  stopCameraScanner();
  document.querySelector('#cameraScanModal')?.classList.add('hidden');
  document.body.classList.remove('camera-scan-open');
}
function cameraNoBarcodeFrame() {
  if (!cameraScanner.active) return;
  if (cameraScanner.locked) {
    if (Date.now() - cameraScanner.acceptedAt > 1200 && ++cameraScanner.blankFrames >= 4) {
      cameraScanner.locked = false;
      cameraScanner.lockedCode = '';
      cameraScanner.candidate = '';
      cameraScanner.hits = 0;
      cameraScanner.blankFrames = 0;
      cameraScanStatus('Ready for the next item. Hold its barcode inside the frame.');
    }
  } else {
    cameraScanner.candidate = '';
    cameraScanner.hits = 0;
  }
}
function cameraBarcodeFormatName(value) {
  if (typeof value === 'string') return value;
  const formats = cameraScanner.zxing?.BarcodeFormat;
  if (formats) {
    const name = Object.keys(formats).find(key => formats[key] === value);
    if (name) return name;
  }
  return String(value || '');
}
function processCameraBarcode(rawValue, rawFormat) {
  if (!cameraScanner.active) return;
  const code = String(rawValue || '').trim();
  if (!code) return cameraNoBarcodeFrame();
  if (cameraScanner.locked) {
    if (code === cameraScanner.lockedCode) { cameraScanner.blankFrames = 0; return; }
    cameraScanner.locked = false;
    cameraScanner.candidate = '';
    cameraScanner.hits = 0;
  }
  cameraScanner.blankFrames = 0;
  const format = cameraBarcodeFormatName(rawFormat).toUpperCase().replaceAll('-', '_');
  if (!cameraBarcodeIsValid(code, format)) {
    cameraScanner.candidate = code;
    cameraScanner.hits = 0;
    cameraScanStatus('Barcode not confirmed (' + format.replaceAll('_', ' ') + '). Hold steady and try again.', 'error');
    return;
  }
  if (cameraScanner.candidate === code) cameraScanner.hits++;
  else { cameraScanner.candidate = code; cameraScanner.hits = 1; }
  if (cameraScanner.hits < 2) {
    cameraScanStatus('Reading twice to confirm… keep the barcode steady.');
    return;
  }
  cameraScanner.locked = true;
  cameraScanner.lockedCode = code;
  cameraScanner.acceptedAt = Date.now();
  cameraScanner.blankFrames = 0;
  const matches = state.products.filter(product => String(product.barcode || '').trim() === code);
  if (matches.length === 0) {
    cameraScanStatus('No exact barcode match in this store. Nothing was added. You can search or add this barcode in Inventory.', 'error');
    return;
  }
  if (matches.length > 1) {
    cameraScanStatus('This barcode belongs to more than one product. Nothing was added; fix the duplicate in Inventory.', 'error');
    return;
  }
  const product = matches[0];
  const line = cart.find(item => String(item.productId) === String(product.id));
  if (+product.qty <= 0 || (line?.qty || 0) >= +product.qty) {
    cameraScanStatus(product.name + ' has no more available stock. Nothing was added.', 'error');
    return;
  }
  if (line) line.qty++;
  else cart.push({ productId: product.id, name: product.name, price: +product.price, gst: +product.gst || 0, qty: 1 });
  renderPOS();
  try { navigator.vibrate?.(45); } catch {}
  cameraScanStatus('Added ' + product.name + '. Lift the barcode out of view before scanning the next item.', 'success');
}
async function scanWithNativeDetector(video, token) {
  if (typeof window.BarcodeDetector !== 'function') return false;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = cameraScanFormats.filter(format => supported.includes(format));
    if (!formats.length || !cameraScanner.active || token !== cameraScanner.token) return false;
    cameraScanner.detector = new window.BarcodeDetector({ formats });
    cameraScanStatus('Camera ready. Place one product barcode inside the frame.');
    const loop = async () => {
      if (!cameraScanner.active || token !== cameraScanner.token) return;
      if (!cameraScanner.busy && video.readyState >= 2) {
        cameraScanner.busy = true;
        try {
          const found = await cameraScanner.detector.detect(video);
          if (found?.length) processCameraBarcode(found[0].rawValue, found[0].format);
          else cameraNoBarcodeFrame();
        } catch { cameraNoBarcodeFrame(); }
        finally { cameraScanner.busy = false; }
      }
      if (cameraScanner.active && token === cameraScanner.token) cameraScanner.timer = setTimeout(loop, 150);
    };
    loop();
    return true;
  } catch { cameraScanner.detector = null; return false; }
}
function setupCameraTrack(track) {
  cameraScanner.track = track;
  try {
    const caps = track.getCapabilities?.() || {};
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }
    if (caps.zoom && Number(caps.zoom.max) > 1) {
      track.applyConstraints({ advanced: [{ zoom: Math.min(1.6, Number(caps.zoom.max)) }] }).catch(() => {});
    }
    const torch = document.querySelector('#scanTorchBtn');
    if (torch && caps.torch) torch.hidden = false;
  } catch {}
}
async function startCameraScanner() {
  const panel = document.querySelector('#cameraScanModal');
  const video = document.querySelector('#scanVideo');
  panel.classList.remove('hidden');
  document.body.classList.add('camera-scan-open');
  cameraScanner.active = true;
  cameraScanner.candidate = '';
  cameraScanner.hits = 0;
  cameraScanner.locked = false;
  cameraScanner.lockedCode = '';
  const token = ++cameraScanner.token;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    cameraScanStatus('Camera access requires the HTTPS Mart360 site and your browser’s camera permission. Use barcode search meanwhile.', 'error');
    return;
  }
  cameraScanStatus('Opening the back camera…');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } },
    });
    if (!cameraScanner.active || token !== cameraScanner.token) { stream.getTracks().forEach(track => track.stop()); return; }
    cameraScanner.stream = stream;
    video.srcObject = stream;
    await video.play();
    setupCameraTrack(stream.getVideoTracks()[0]);
    if (await scanWithNativeDetector(video, token)) return;
    cameraScanStatus('Loading the compatible barcode reader…');
    const zxing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/+esm');
    if (!cameraScanner.active || token !== cameraScanner.token) return;
    cameraScanner.zxing = zxing;
    const reader = new zxing.BrowserMultiFormatReader();
    cameraScanner.controls = await reader.decodeFromStream(stream, video, (result, error) => {
      if (!cameraScanner.active || token !== cameraScanner.token) return;
      if (result) processCameraBarcode(result.getText(), result.getBarcodeFormat());
      else cameraNoBarcodeFrame();
    });
    if (cameraScanner.active) cameraScanStatus('Camera ready. Place one product barcode inside the frame.');
  } catch (error) {
    stopCameraStreamOnly();
    const messages = {
      NotAllowedError: 'Camera permission was blocked. Allow camera access for Mart360 in your browser settings, then try again.',
      NotFoundError: 'No camera was found on this device. Use barcode search or a USB/Bluetooth scanner.',
      NotReadableError: 'The camera is busy in another app. Close that app and retry.',
      OverconstrainedError: 'This camera could not meet the requested settings. Retry or use barcode search.',
    };
    const message = messages[error?.name] || 'Camera scanning could not start. Check your connection and camera permission, then retry. You can use barcode search meanwhile.';
    cameraScanStatus(message, 'error');
  }
}
document.querySelector('#openCameraScanner').onclick = startCameraScanner;
document.querySelector('#closeCameraScanner').onclick = closeCameraScanner;
document.querySelector('#scanStopBtn').onclick = closeCameraScanner;
document.querySelector('#scanManualBtn').onclick = () => { closeCameraScanner(); document.querySelector('#scanInput').focus(); };
document.querySelector('#cameraScanModal').onclick = event => { if (event.target === document.querySelector('#cameraScanModal')) closeCameraScanner(); };
document.querySelector('#scanTorchBtn').onclick = async event => {
  if (!cameraScanner.track) return;
  const button = event.currentTarget;
  try {
    cameraScanner.torchOn = !cameraScanner.torchOn;
    await cameraScanner.track.applyConstraints({ advanced: [{ torch: cameraScanner.torchOn }] });
    button.textContent = cameraScanner.torchOn ? '☼ Turn off light' : '☼ Turn on light';
  } catch { cameraScanner.torchOn = false; cameraScanStatus('This camera does not support its torch control.'); }
};
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('#cameraScanModal').classList.contains('hidden')) closeCameraScanner(); });
