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

  // ✅ Solo los formatos que soportan letras + guiones
  formats = [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39];

  // Patrón EXACTO requerido
  private EXACT_REGEX = /^J5-STR-\d{6}-\d{5}-\d{5}-\d{6}$/;

  // Patrón LAX (por si viene con ruido o caracteres extraños)
  private LAX_REGEX = /J5\W*-\W*STR\W*-\W*\d{6}\W*-\W*\d{5}\W*-\W*\d{5}\W*-\W*\d{6}/i;

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;

  lastResult: string | null = null;    // último código válido
  lastIgnored: string | null = null;   // último descartado

  torchOn = false;
  torchAvailable = false;

  allScannedCodes: Array<{ text: string; format: string; timestamp: Date }> = [];

  // Anti-duplicado / estabilidad
  private lastRaw = '';
  private stableCount = 0;
  private neededStableReads = 2; // requerir 2 lecturas iguales

  // Cooldown (ms) para evitar múltiples lecturas seguidas
  private cooldownMs = 900;
  private lastAcceptTime = 0;

  // Zoom
  zoomSupported: boolean = false;
  zoomMin: number = 1;
  zoomMax: number = 1;
  zoom: number = 1;

  constructor(public auth: AuthService) {}

  ngAfterViewInit(): void {
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
      // ignorar si no hay soporte
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
      console.warn("El zoom no pudo aplicarse.");
    }
  }

  onCamerasFound(devs: MediaDeviceInfo[]) {
    this.devices = devs || [];
    const back = this.devices.find(d =>
      /back|rear|trás|trasera|environment/i.test(d.label || '')
    );
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

  private sanitize(raw: string): string {
    let t = raw ?? '';
    t = t.replace(/^\*+|\*+$/g, '');
    t = t.replace(/[\u2010-\u2015]/g, '-'); // guiones raros → '-'
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  private extractTarget(text: string): string | null {
    if (this.EXACT_REGEX.test(text)) return text;
    const m = text.match(this.LAX_REGEX);
    if (m && m[0]) {
      const norm = m[0]
        .toUpperCase()
        .replace(/J5\W*-\W*STR\W*-/i, 'J5-STR-')
        .replace(/\W+/g, '-') 
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

    this.allScannedCodes.unshift({ text: cleaned, format, timestamp: new Date() });
    if (this.allScannedCodes.length > 20) this.allScannedCodes.length = 20;

    if (cleaned === this.lastRaw) {
      this.stableCount++;
    } else {
      this.lastRaw = cleaned;
      this.stableCount = 1;
    }

    if (this.stableCount < this.neededStableReads) {
      this.lastIgnored = cleaned;
      return;
    }

    if (this.now() - this.lastAcceptTime < this.cooldownMs) {
      this.lastIgnored = cleaned;
      return;
    }

    const candidate = this.extractTarget(cleaned.toUpperCase());
    if (candidate && this.EXACT_REGEX.test(candidate)) {
      this.lastResult = candidate;
      this.lastIgnored = null;
      this.lastAcceptTime = this.now();
      console.log('[OK] Código válido:', candidate);
    } else {
      this.lastIgnored = cleaned;
    }
  }

  onScanError(_err: any) {
    // ruido normal
  }

  toggleTorch() { this.torchOn = !this.torchOn; }

  logout() { this.auth.logout(); }

  clearHistory() { this.allScannedCodes = []; }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => alert('Copiado al portapapeles'));
  }
}
