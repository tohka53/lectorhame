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
  formats = [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.DATA_MATRIX,
  ];

  devices: MediaDeviceInfo[] = [];
  // ✅ que sea opcional/undefined (no null)
  selectedDevice?: MediaDeviceInfo;

  lastResult: string | null = null;
  torchOn = false;

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
    this.lastResult = text;
  }

  onScanError(err: any) {
    console.warn(err);
  }

  // ✅ sin referencia al componente; solo alternamos el @Input [torch]
  toggleTorch() {
    this.torchOn = !this.torchOn;
  }
}
