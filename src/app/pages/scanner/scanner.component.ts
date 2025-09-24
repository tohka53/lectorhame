import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarcodeFormat } from '@zxing/library';

type ParsedCode = {
  raw: string;
  serie: string;
  empresa: string;
  noDoc: string;
  lote?: string;
  planta?: string;
  envio?: string;
};

@Component({
  selector: 'app-scanner',
  standalone: false,  
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent {
  formats = [BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODE_128];

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;

  lastResult: string | null = null;
  lastParsed: ParsedCode | null = null;

  torchOn = false;

  videoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  };

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
    const cleaned = text.replace(/^\*+|\*+$/g, '').trim();
    this.lastResult = cleaned;

    const m = cleaned.match(this.re);
    if (m) {
      const [, noDoc, lote, planta, envio] = m;
      this.lastParsed = {
        raw: cleaned,
        serie: 'J5',
        empresa: 'STR',
        noDoc, lote, planta, envio
      };
    } else {
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
