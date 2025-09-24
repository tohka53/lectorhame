import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarcodeFormat } from '@zxing/library';

@Component({
  selector: 'app-scanner',
  standalone: false,
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent {
  // Habilita formatos 1D comunes (tu etiqueta suele ser Code 128)
  formats = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ];

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;

  // Texto leído (muestra siempre el bruto; luego puedes parsear)
  lastResult: string | null = null;

  // Linterna (si el navegador/dispositivo la soporta)
  torchOn = false;

  // Alta resolución y cámara trasera
  videoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width:  { ideal: 1920 },   // prueba 2560x1440 si tu móvil es potente
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  };

  constructor(public auth: AuthService) {}

  // Evento de ngx-scanner: lista las cámaras disponibles
  onCamerasFound(devs: MediaDeviceInfo[]) {
    this.devices = devs || [];
    if (this.devices.length) {
      const back = this.devices.find(d => /back|rear|trás|trasera|environment/i.test(d.label));
      this.selectedDevice = back ?? this.devices[0];
    } else {
      this.selectedDevice = undefined;
    }
  }

  onHasDevices(has: boolean) {
    if (!has) console.warn('No se detectaron cámaras en el dispositivo.');
  }

  // ¡Siempre muestra el bruto! Luego, si quieres, limpias/parseas
  onScanSuccess(text: string) {
    const cleaned = text.replace(/^\*+|\*+$/g, '').trim(); // quita * de Code39 impresos
    this.lastResult = cleaned;
    // Aquí puedes parsear tu patrón, pero NO bloquees la actualización de UI
    // const m = cleaned.match(/^J5-STR-(\d{6})-(\d{5})-(\d{5})-(\d{6})$/);
    // if (m) { ... }
  }

  onScanError(err: any) {
    // Errores de decodificación son normales mientras intenta leer
    // console.warn(err);
  }

  toggleTorch() {
    this.torchOn = !this.torchOn;
  }

  logout() {
    this.auth.logout();
  }
}
