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
  // ✅ ACEPTA SOLO 1D ALFANUMÉRICOS (evita EAN/UPC)
  formats = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
  ];

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;
  lastResult: string | null = null;      // lo que sí aceptamos (B160495-STR-...)
  lastIgnored: string | null = null;     // lo que descartamos (p.ej., EAN-13)
  torchOn = false;
  torchAvailable = false; // ✅ Agregado

  // ✅ PATRÓN CORREGIDO para tu documento: B160495 - STR - 5314 - 1
  // Acepta espacios opcionales alrededor de los guiones
  private readonly wanted = /^[A-Z]\d{6}\s*-\s*STR\s*-\s*\d{4}\s*-\s*\d+$/;
  
  // Para ignorar EAN/UPC puros (12–14 dígitos)
  private readonly looksLikeEAN = /^\d{12,14}$/;

  constructor(public auth: AuthService) {}

  onCamerasFound(devs: MediaDeviceInfo[]) {
    console.log('📷 Cámaras encontradas:', devs?.length || 0);
    this.devices = devs || [];
    const back = this.devices.find(d => /back|rear|trás|trasera|environment/i.test(d.label || ''));
    this.selectedDevice = back ?? this.devices[0];
    if (this.selectedDevice) {
      console.log('📷 Cámara seleccionada:', this.selectedDevice.label);
    }
  }

  onHasDevices(has: boolean) {
    console.log('📷 Tiene dispositivos:', has);
    if (!has) console.warn('No se detectaron cámaras.');
  }

  // ✅ MÉTODOS FALTANTES
  onTorchCompatible(compatible: boolean) {
    console.log('🔦 Flash disponible:', compatible);
    this.torchAvailable = compatible;
  }

  onPermissionResponse(permission: boolean) {
    console.log('🔑 Permisos:', permission ? 'Concedidos' : 'Denegados');
    if (!permission) {
      alert('Se requieren permisos de cámara para escanear códigos');
    }
  }

  onDeviceSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const deviceIndex = parseInt(select.value);
    this.selectedDevice = this.devices[deviceIndex];
    console.log('📷 Cambiando a cámara:', this.selectedDevice?.label);
  }

  onScanSuccess(text: string) {
    const cleaned = text.replace(/^\*+|\*+$/g, '').trim(); // quita * de Code39
    
    console.log('Código escaneado:', cleaned); // Para debug
    
    // ❌ Si es EAN/UPC (solo dígitos), lo ignoramos y mostramos en "descartados"
    if (this.looksLikeEAN.test(cleaned)) {
      this.lastIgnored = cleaned;
      return;
    }

    // ✅ Acepta solo si coincide el patrón B160495 - STR - 5314 - 1
    if (this.wanted.test(cleaned)) {
      this.lastResult = cleaned;
      this.lastIgnored = null;
      console.log('✅ Código válido encontrado:', cleaned);
      // (opcional) pausar un momento para que no repita:
      // setTimeout(() => this.lastResult = null, 1500);
    } else {
      // No es EAN pero tampoco es el formato objetivo; lo mostramos como descartado
      this.lastIgnored = cleaned;
      console.log('⚠️ Código no válido:', cleaned);
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
}