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
  // ✅ ACEPTA MÁS FORMATOS DE CÓDIGOS DE BARRAS
  formats = [
    BarcodeFormat.CODE_128,     // Más común para documentos
    BarcodeFormat.CODE_39,      // También común
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODABAR,      // A veces usado en documentos
    BarcodeFormat.ITF,          // Interleaved 2 of 5
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
    
    console.log('=== CÓDIGO COMPLETO ESCANEADO ===');
    console.log('Raw:', text);
    console.log('Cleaned:', cleaned);
    console.log('Longitud:', cleaned.length);
    console.log('=================================');
    
    // ❌ Si es EAN/UPC (solo dígitos), lo ignoramos
    if (this.looksLikeEAN.test(cleaned)) {
      this.lastIgnored = `EAN/UPC: ${cleaned}`;
      return;
    }

    // ✅ Buscar el patrón B160495 - STR - 5314 - 1 DENTRO del texto escaneado
    const match = cleaned.match(/[A-Z]\d{6}\s*-\s*STR\s*-\s*\d{4}\s*-\s*\d+/);
    if (match) {
      this.lastResult = match[0]; // Solo la parte que coincide
      this.lastIgnored = null;
      console.log('✅ Código válido encontrado:', match[0]);
      console.log('✅ Extraído de:', cleaned.substring(0, 100) + '...');
    } else {
      // Mostrar los primeros 200 caracteres para debug
      const preview = cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned;
      this.lastIgnored = `No matching pattern in: ${preview}`;
      console.log('⚠️ Patrón no encontrado en:', cleaned);
      
      // Intentar encontrar cualquier cosa que contenga "STR"
      if (cleaned.includes('STR')) {
        console.log('🔍 Texto contiene "STR", buscando contexto...');
        const strIndex = cleaned.indexOf('STR');
        const context = cleaned.substring(Math.max(0, strIndex - 20), strIndex + 30);
        console.log('🔍 Contexto alrededor de STR:', context);
      }
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