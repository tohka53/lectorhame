import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarcodeFormat } from '@zxing/library';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent {
  // ✅ ACEPTA SOLO 1D ALFANUMÉRICOS (evita EAN/UPC)
  formats = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
  ];

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;

  lastResult: string | null = null;      // lo que sí aceptamos (J5-STR-...)
  lastIgnored: string | null = null;     // lo que descartamos (p.ej., EAN-13)
  torchOn = false;

  videoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  };

  // ✅ patrón esperado: J5-STR-######-#####-#####-######
  private readonly wanted = /^J5-STR-\d{6}-\d{5}-\d{5}-\d{6}$/;
  // para ignorar EAN/UPC puros (12–14 dígitos)
  private readonly looksLikeEAN = /^\d{12,14}$/;

  constructor(public auth: AuthService) {}

  onCamerasFound(devs: MediaDeviceInfo[]) {
    this.devices = devs || [];
    const back = this.devices.find(d => /back|rear|trás|trasera|environment/i.test(d.label));
    this.selectedDevice = back ?? this.devices[0];
  }

  onHasDevices(has: boolean) {
    if (!has) console.warn('No se detectaron cámaras.');
  }

  onScanSuccess(text: string) {
    const cleaned = text.replace(/^\*+|\*+$/g, '').trim(); // quita * de Code39
    // ❌ Si es EAN/UPC (solo dígitos), lo ignoramos y mostramos en "descartados"
    if (this.looksLikeEAN.test(cleaned)) {
      this.lastIgnored = cleaned;
      return;
    }
    // ✅ Acepta solo si coincide el patrón J5-STR-...
    if (this.wanted.test(cleaned)) {
      this.lastResult = cleaned;
      this.lastIgnored = null;
      // (opcional) pausar un momento para que no repita:
      // setTimeout(() => this.lastResult = null, 1500);
    } else {
      // No es EAN pero tampoco es el formato objetivo; lo mostramos como descartado
      this.lastIgnored = cleaned;
    }
  }

  onScanError(_err: any) { /* normal mientras intenta */ }
  toggleTorch() { this.torchOn = !this.torchOn; }
  logout() { this.auth.logout(); }
}
