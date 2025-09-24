import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarcodeFormat } from '@zxing/library';

type ParsedCode = {
  raw: string;
  serie: string;          // J5
  empresa: string;        // STR
  noDoc: string;          // 264019
  lote?: string;          // 00016 (significado tentativo)
  planta?: string;        // 41131
  envio?: string;         // 336923
};

@Component({
  selector: 'app-scanner',
  standalone: false,
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent {
  // Solo Code 39 y Code 128 (el formato de tu código es alfanumérico con guiones)
  formats = [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128];

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;

  lastResult: string | null = null;
  lastParsed: ParsedCode | null = null;

  torchOn = false;

  // Patrón: J5-STR-######-#####-#####-######
  // quitamos asteriscos al inicio/fin si los hay
  private readonly re = /^J5-STR-(\d{6})-(\d{5})-(\d{5})-(\d{6})$/;

  constructor(public auth: AuthService) {}

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
    if (!has) console.warn('No se detectaron cámaras.');
  }

  onScanSuccess(text: string) {
    // Limpia posibles asteriscos de Code39 impresos en la leyenda humana
    const cleaned = text.replace(/^\*+|\*+$/g, '').trim();

    // Guarda el último bruto
    this.lastResult = cleaned;

    // Valida patrón
    const m = cleaned.match(this.re);
    if (m) {
      const [, noDoc, lote, planta, envio] = m;
      this.lastParsed = {
        raw: cleaned,
        serie: 'J5',
        empresa: 'STR',
        noDoc,
        lote,
        planta,
        envio
      };
    } else {
      // Si no coincide, no lo aceptamos como “válido” para tu caso
      this.lastParsed = null;
    }
  }

  onScanError(err: any) {
    console.warn(err);
  }

  toggleTorch() {
    this.torchOn = !this.torchOn;
  }
}
