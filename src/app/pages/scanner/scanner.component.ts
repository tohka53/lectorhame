import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';

@Component({
  selector: 'app-scanner',
  standalone: false,
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent implements AfterViewInit {
  @ViewChild('scanner') scannerCmp?: ZXingScannerComponent;

  // ✅ TODOS los formatos soportados por @zxing/library
  // (Si prefieres "todos" sin listar, podrías omitir [formats] en el template,
  // pero explícito es mejor para controlar compatibilidad.)
  formats: BarcodeFormat[] = [
    BarcodeFormat.AZTEC,
    BarcodeFormat.CODABAR,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODE_128,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.EAN_8,
    BarcodeFormat.EAN_13,
    BarcodeFormat.ITF,
    BarcodeFormat.MAXICODE,
    BarcodeFormat.PDF_417,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.RSS_14,
    BarcodeFormat.RSS_EXPANDED,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.UPC_EAN_EXTENSION
  ];

  // Patrón EXACTO requerido
  private EXACT_REGEX = /^J5-STR-\d{6}-\d{5}-\d{5}-\d{6}$/;

  // Patrón LAX para extraer aunque venga con ruido o separadores raros
  private LAX_REGEX = /J5\W*-\W*STR\W*-\W*\d{6}\W*-\W*\d{5}\W*-\W*\d{5}\W*-\W*\d{6}/i;

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;

  lastResult: string | null = null;    // último código válido (formato objetivo)
  lastIgnored: string | null = null;   // última lectura descartada

  torchOn = false;
  torchAvailable = false;

  allScannedCodes: Array<{ text: string; format: string; timestamp: Date }> = [];

  // Estabilidad y cooldown
  private lastRaw = '';
  private stableCount = 0;
  private neededStableReads = 2; // 2 o 3 según ruido
  private cooldownMs = 900;
  private lastAcceptTime = 0;

  // Zoom
  zoomSupported: boolean = false;
  zoomMin: number = 1;
  zoomMax: number = 1;
  zoom: number = 1;

  constructor(public auth: AuthService) {}

  ngAfterViewInit(): void {
    // Activar tryHarder para mejorar lectura en condiciones difíciles
    // (se setea en template con [tryHarder]="true")
    setTimeout(() => this.initTrackCapabilities(), 300);
  }

  private async initTrackCapabilities() {
    try {
      const video = this.getVideoEl();
      const track = video?.srcObject instanceof MediaStream
        ? video.srcObject.getVideoTracks()[0]
        : undefined;

      if (!track) return;

      const caps: any = (track.getCapabilities && track.getCapabilities()) || {};
      if (caps.zoom) {
        this.zoomSupported = true;
        this.zoomMin = caps.zoom.min ?? 1;
        this.zoomMax = caps.zoom.max ?? 1;
        this.zoom = Math.min(Math.max(this.zoom, this.zoomMin), this.zoomMax);
      }
    } catch {
      // ignore
    }
  }

  getVideoEl(): HTMLVideoElement | null {
    const host = document.querySelector('zxing-scanner');
    if (!host) return null;
    return host.querySelector('video') as HTMLVideoElement | null;
  }

  async applyZoom() {
    if (!this.zoomSupported) return;
    const video = this.getVideoEl();
    const track = video?.srcObject instanceof MediaStream
      ? video.srcObject.getVideoTracks()[0]
      : undefined;

    if (!track || !track.applyConstraints) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: this.zoom }] as any });
    } catch {
      console.warn('No se pudo aplicar zoom en este dispositivo.');
    }
  }

  onCamerasFound(devs: MediaDeviceInfo[]) {
    this.devices = devs || [];
    const back = this.devices.find(d => /back|rear|trás|trasera|environment/i.test(d.label || ''));
    this.selectedDevice = back ?? this.devices[0];
    setTimeout(() => this.initTrackCapabilities(), 500);
  }

  onHasDevices(has: boolean) {
    if (!has) console.warn('No se detectaron cámaras.');
  }

  onTorchCompatible(compatible: boolean) {
    this.torchAvailable = compatible;
  }

  onPermissionResponse(permission: boolean) {
    if (!permission) alert('Se requieren permisos de cámara para escanear códigos');
  }

  onDeviceSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const deviceIndex = parseInt(select.value, 10);
    this.selectedDevice = this.devices[deviceIndex];
    setTimeout(() => this.initTrackCapabilities(), 500);
  }

  // Normaliza texto crudo
  private sanitize(raw: string): string {
    let t = raw ?? '';
    t = t.replace(/^\*+|\*+$/g, '');           // quita asteriscos de algunos lectores
    t = t.replace(/[\u2010-\u2015]/g, '-');    // guiones tipográficos → '-'
    t = t.replace(/\s+/g, ' ').trim();         // espacios múltiples
    return t;
  }

  // Extrae el patrón objetivo aunque venga con ruido/separadores
  private extractTarget(text: string): string | null {
    if (this.EXACT_REGEX.test(text)) return text;
    const m = text.match(this.LAX_REGEX);
    if (m && m[0]) {
      const norm = m[0]
        .toUpperCase()
        .replace(/J5\W*-\W*STR\W*-/i, 'J5-STR-')
        .replace(/\W+/g, '-')     // todo separador raro → '-'
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      return this.EXACT_REGEX.test(norm) ? norm : null;
    }
    return null;
  }

  private now() { return Date.now(); }

  onScanSuccess(result: any) {
    const textRaw = typeof result === 'string'
      ? result
      : (result?.text || result?.getText?.() || '');

    const format = typeof result === 'object' ? (result?.format || 'Unknown') : 'Unknown';
    const cleaned = this.sanitize(textRaw);

    // Historial de lecturas crudas (debug)
    this.allScannedCodes.unshift({ text: cleaned, format, timestamp: new Date() });
    if (this.allScannedCodes.length > 20) this.allScannedCodes.length = 20;

    // Estabilidad (mismas lecturas seguidas)
    if (cleaned === this.lastRaw) this.stableCount++;
    else { this.lastRaw = cleaned; this.stableCount = 1; }

    if (this.stableCount < this.neededStableReads) {
      this.lastIgnored = cleaned;
      return;
    }

    // Cooldown
    if (this.now() - this.lastAcceptTime < this.cooldownMs) {
      this.lastIgnored = cleaned;
      return;
    }

    // Extraemos TU código, venga del formato que venga
    const candidate = this.extractTarget(cleaned.toUpperCase());
    if (candidate && this.EXACT_REGEX.test(candidate)) {
      this.lastResult = candidate;       // <- este es el valor final que necesitas
      this.lastIgnored = null;
      this.lastAcceptTime = this.now();

      // Aquí dispara tu flujo (buscar/guardar/navegar):
      // this.onValidCode(candidate);

      console.log('[OK] Código válido:', candidate, 'Formato:', format);
    } else {
      this.lastIgnored = cleaned;
    }
  }

  onScanError(_err: any) {
    // Errores intermitentes durante el escaneo son normales
  }

  toggleTorch() { this.torchOn = !this.torchOn; }

  logout() { this.auth.logout(); }

  clearHistory() { this.allScannedCodes = []; }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => alert('Copiado al portapapeles'));
  }
}
