import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarcodeFormat } from '@zxing/library';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css'],
  standalone: false,
  // NO incluir 'standalone: true' aqui
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
  lastResult: string | null = null;      // lo que sí aceptamos
  lastIgnored: string | null = null;     // lo que descartamos
  torchOn = false;
  
  videoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  };

  // ✅ PATRÓN CORREGIDO: Acepta códigos como B160495 - STR - 5314 - 1
  // Formato flexible: [LETRA+NÚMEROS] - STR - [NÚMEROS] - [NÚMEROS]
  private readonly wanted = /^[A-Z]\d{6}\s*-\s*STR\s*-\s*\d{4}\s*-\s*\d+$/;
  
  // También acepta el formato alternativo J5-STR-######-#####-#####-######
  private readonly wantedAlt = /^J5-STR-\d{6}-\d{5}-\d{5}-\d{6}$/;
  
  // Para ignorar EAN/UPC puros (12–14 dígitos)
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
    
    // ❌ Si es EAN/UPC (solo dígitos), lo ignoramos
    if (this.looksLikeEAN.test(cleaned)) {
      this.lastIgnored = cleaned;
      console.log('Código EAN/UPC ignorado:', cleaned);
      return;
    }

    // ✅ Acepta si coincide alguno de los patrones válidos
    if (this.wanted.test(cleaned) || this.wantedAlt.test(cleaned)) {
      this.lastResult = cleaned;
      this.lastIgnored = null;
      console.log('Código válido encontrado:', cleaned);
      
      // (opcional) pausar un momento para que no repita:
      // setTimeout(() => this.lastResult = null, 1500);
    } else {
      // No es EAN pero tampoco es el formato objetivo
      this.lastIgnored = cleaned;
      console.log('Código no reconocido:', cleaned);
    }
  }

  onScanError(_err: any) { 
    // Normal mientras intenta leer
  }

  toggleTorch() { 
    this.torchOn = !this.torchOn; 
  }

  logout() { 
    this.auth.logout(); 
  }

  // Método auxiliar para limpiar y normalizar códigos
  private normalizeCode(code: string): string {
    return code.replace(/\s+/g, ' ').trim();
  }
}